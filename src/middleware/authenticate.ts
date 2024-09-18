import db from "@/db";
import { refreshTokensTable } from "@/db/schema";
import {
	generateAccessToken,
	generateRefreshToken,
	safeVerifyAccessToken,
	verifyRefreshToken
} from "@/util/jwt";
import logger from "@/util/logger";
import { dbQueue } from "@/util/queue";
import { APIError } from "@/util/util";
import { and, eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { JWTExpired } from "jose/errors";

declare module "express" {
	export interface Request {
		user?: {
			id: string;
			role: string;
		};
	}
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
	const token = req.headers.authorization?.split("Bearer ")[1];

	const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
	const UNAUTHORIZED_ERROR = new APIError(401, "Unauthorized");
	if (!token) {
		return next(UNAUTHORIZED_ERROR);
	}

	try {
		const { status, payload: accessPayload } = await safeVerifyAccessToken(token);

		// If token is valid, set the user object in the request
		if (status === "valid" && accessPayload) {
			req.user = accessPayload;
			return next();
		}

		// If token is invalid, return unauthorized
		if (status === "invalid") {
			throw UNAUTHORIZED_ERROR;
		}

		// =========== Expired token =============
		// Check if refresh token is present and valid
		// If valid, generate new access token and set it in the header
		// Generate new refresh token and set it in the cookie and update db
		if (!refreshToken) {
			throw UNAUTHORIZED_ERROR;
		}

		// Will throw an error if refresh token is invalid
		// In which case the user is unauthorized
		const { payload: refreshPayload } = await verifyRefreshToken(refreshToken);

		if (!accessPayload || refreshPayload.id !== accessPayload.id) {
			// Why would this happen?
			// A compromised refresh token is being used to get a new access token for a different user?
			throw UNAUTHORIZED_ERROR;
		}

		// Refresh token is valid but not in the database means user is unauthorized
		const foundToken = await db.query.refreshTokensTable.findFirst({
			where: and(
				eq(refreshTokensTable.refresh_token, refreshToken),
				eq(refreshTokensTable.user_id, accessPayload.id ?? "")
			),
			columns: {
				id: true
			}
		});

		if (!foundToken) {
			throw UNAUTHORIZED_ERROR;
		}

		const p = {
			id: refreshPayload.id,
			role: refreshPayload.role
		};
		const newAccessToken = await generateAccessToken(p);
		const newRefreshToken = await generateRefreshToken(p);

		dbQueue
			.createJob([
				{
					refresh_token: newRefreshToken,
					user_id: refreshPayload.id,
					device: req.headers["user-agent"] ?? null
				},
				refreshToken
			])
			.save();

		res.setHeader("Authorization", `Bearer ${newAccessToken}`);
		res.cookie("refreshToken", newRefreshToken, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production"
		});

		req.user = refreshPayload;

		return next();
	} catch (error) {
		// Refresh token is invalid/expired
		if (error instanceof JWTExpired) {
			logger.error(error, "Refresh token expired");
		}
		res.clearCookie("refreshToken");
		return next(UNAUTHORIZED_ERROR);
	}
}
