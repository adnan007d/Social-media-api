import db from "@/db";
import { refreshTokensTable } from "@/db/schema";
import { generateTokens, safeVerifyAccessToken, verifyRefreshToken } from "@/util/jwt";
import logger from "@/util/logger";
import { dbQueue } from "@/util/queue";
import { APIError, COOKIE_OPTIONS } from "@/util/util";
import { and, eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { type JWTPayload } from "jose";
import { JWTExpired } from "jose/errors";

declare module "express" {
	export interface Request {
		user?: {
			id: string;
			role: string;
		};
	}
}

const UNAUTHORIZED_ERROR = new APIError(401, "Unauthorized");

export async function authenticate(req: Request, res: Response, next: NextFunction) {
	const token = req.headers.authorization?.split("Bearer ")[1];
	try {
		if (!token) {
			throw UNAUTHORIZED_ERROR;
		}

		const { status, payload } = await safeVerifyAccessToken(token);

		switch (status) {
			case "valid":
				if (payload) await handleValidToken(req, payload);
				break;
			case "expired":
				if (payload) await handleExpiredToken(req, res, payload);
				break;
			default:
				throw UNAUTHORIZED_ERROR;
		}

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

async function handleValidToken(req: Request, payload: JWTPayload) {
	req.user = payload;
	return;
}

async function handleExpiredToken(req: Request, res: Response, accessPayload: JWTPayload) {
	const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
	if (!refreshToken) {
		throw UNAUTHORIZED_ERROR;
	}

	const { payload: refreshPayload } = await verifyRefreshToken(refreshToken);
	if (!accessPayload || refreshPayload.id !== accessPayload.id) {
		throw UNAUTHORIZED_ERROR;
	}

	const foundToken = await db.query.refreshTokensTable.findFirst({
		where: and(
			eq(refreshTokensTable.refresh_token, refreshToken),
			eq(refreshTokensTable.user_id, accessPayload.id ?? "")
		),
		columns: {
			id: true
		}
	});

	if (!foundToken) throw UNAUTHORIZED_ERROR;

	await refreshTokens(req, res, refreshPayload);
}

async function refreshTokens(req: Request, res: Response, payload: JWTPayload) {
	const { accessToken, refreshToken } = await generateTokens(payload);

	dbQueue
		.createJob([
			{
				refresh_token: refreshToken,
				user_id: payload.id,
				device: req.headers["user-agent"] ?? null
			},
			req.cookies.refreshToken || req.body.refreshToken
		])
		.save();

	res.setHeader("Authorization", `Bearer ${accessToken}`);
	res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

	handleValidToken(req, payload);
}
