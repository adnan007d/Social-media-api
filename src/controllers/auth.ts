import { deleteOldRefreshTokens, insertUserInDB, selectUserByEmail } from "@/util/db";
import { generateTokens } from "@/util/jwt";
import logger from "@/util/logger";
import { dbQueue } from "@/util/queue";
import { APIError, comparePassword, COOKIE_OPTIONS, hashPassword } from "@/util/util";
import { signInSchema } from "@/util/validations";
import type { Request, Response, NextFunction } from "express";
import { PostgresError } from "postgres";

export async function signUp(req: Request, res: Response, next: NextFunction) {
	const body = req.body;
	body.password = await hashPassword(body.password);

	try {
		const [user] = await insertUserInDB(body);

		if (!user) {
			delete body.password;
			logger.error({ user: body }, "User not created");
			return next(new APIError(400, "Bad Request"));
		}

		// TODO: Send verification mail
		return res.status(201).json({
			id: user?.id,
			message: "User created successfully"
		});
	} catch (error) {
		if (error instanceof PostgresError) {
			logger.error(error);
			const apiError = new APIError(400, "Bad Request");
			if (error.code === "23505") {
				if (error.constraint_name === "users_email_unique") {
					apiError.message = "Email already exists";
				} else if (error.constraint_name === "users_username_unique") {
					apiError.message = "Username already taken";
				}
			}
			return next(apiError);
		}

		return next(error);
	}
}

export async function signIn(req: Request, res: Response, next: NextFunction) {
	try {
		const body = await validateSignInBody(req.body);

		const user = await selectUserByEmail(body.email);

		if (!user) {
			logger.error({ err: body.email }, "User not found");
			throw new APIError(401, "Invalid email/password");
		}

		if (!(await comparePassword(body.password, user.password))) {
			logger.error({ err: body.email }, "Invalid password");
			throw new APIError(401, "Invalid email/password");
		}

		const { accessToken, refreshToken } = await generateTokens({ id: user.id, role: user.role });

		await rotateRefreshToken(req, refreshToken, user.id);

		res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

		return res.status(200).json({
			accessToken,
			refreshToken
		});
	} catch (error) {
		if (error instanceof APIError) {
			return next(error);
		}
		logger.error(error);
		return next(new APIError(500, "Internal server error"));
	}
}

// This is because I want to send Invalid email/password message
// Even if the validation is failing for security purpose
async function validateSignInBody(body: unknown) {
	const parsedBody = signInSchema.safeParse(body);
	if (!parsedBody.success) {
		logger.error({ err: parsedBody.error }, "Validation error");
		throw new APIError(401, "Invalid email/password");
	}
	return parsedBody.data;
}

async function rotateRefreshToken(req: Request, newRefreshToken: string, userId: string) {
	const oldRefreshToken = req.cookies.refreshToken;
	await dbQueue
		.createJob([
			{
				refresh_token: newRefreshToken,
				user_id: userId,
				device: req.headers["user-agent"] ?? null
			},
			oldRefreshToken
		])
		.save();
}

export async function logout(req: Request, res: Response) {
	const refreshToken = req.cookies.refreshToken;
	if (!refreshToken) {
		return res.status(200).json({ message: "Logged out successfully" });
	}

	await deleteOldRefreshTokens(refreshToken, req.user!.id);
	res.clearCookie("refreshToken");
	return res.status(200).json({ message: "Logged out successfully" });
}
