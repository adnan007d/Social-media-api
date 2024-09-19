import db from "@/db";
import { usersTable } from "@/db/schema";
import { generateTokens } from "@/util/jwt";
import logger from "@/util/logger";
import { dbQueue } from "@/util/queue";
import { APIError, comparePassword, hashPassword } from "@/util/util";
import { signInSchema, type SignUpBody } from "@/util/validations";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { PostgresError } from "postgres";

export async function signUp(req: Request, res: Response, next: NextFunction) {
	const body: SignUpBody = req.body;

	body.password = await hashPassword(body.password);
	try {
		const result = await db
			.insert(usersTable)
			.values(body)
			.returning({
				id: usersTable.id,
				email: usersTable.email,
				username: usersTable.username
			})
			.execute();

		// TODO: Send verification mail

		return res.status(201).json({
			id: result[0]?.id,
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

		const user = await findUser(body.email);

		if (!(await comparePassword(body.password, user.password))) {
			logger.error({ err: body.email }, "Invalid password");
			throw new APIError(401, "Invalid email/password");
		}

		const { accessToken, refreshToken } = await generateTokens({ id: user.id, role: user.role });

		await rotateRefreshToken(req, refreshToken, user.id);

		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production"
		});

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

async function validateSignInBody(body: unknown) {
	const parsedBody = signInSchema.safeParse(body);
	if (!parsedBody.success) {
		logger.error({ err: parsedBody.error }, "Validation error");
		throw new APIError(400, "Bad Request");
	}
	return parsedBody.data;
}

async function findUser(email: string) {
	const user = await db.query.usersTable.findFirst({
		columns: { id: true, email: true, role: true, password: true },
		where: eq(usersTable.email, email)
	});
	if (!user) {
		logger.error({ err: email }, "User not found");
		throw new APIError(401, "Invalid email/password");
	}
	return user;
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
