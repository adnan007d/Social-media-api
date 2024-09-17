import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import env from "@/env";
import logger from "./logger";
import { JWTExpired } from "jose/errors";

declare module "jose" {
	export interface JWTPayload {
		id: string;
		role: string;
	}
}

const ACCESS_TOKEN_SECRET = new TextEncoder().encode(env.JWT_ACCESS_TOKEN_SECRET);
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(env.JWT_REFRESH_TOKEN_SECRET);

export async function generateAccessToken(payload: JWTPayload) {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("5min")
		.sign(ACCESS_TOKEN_SECRET);
}

export async function generateRefreshToken(payload: JWTPayload) {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("30days")
		.sign(REFRESH_TOKEN_SECRET);
}

export async function verifyAccessToken(token: string) {
	return jwtVerify(token, ACCESS_TOKEN_SECRET);
}

export async function verifyRefreshToken(token: string) {
	return jwtVerify(token, REFRESH_TOKEN_SECRET);
}

/**
 * Safe as in, it will not throw an error if the token is invalid
 * Will return null if the token is invalid
 * Just for my use case
 */
export async function safeVerifyAccessToken(token: string) {
	try {
		return { payload: (await verifyAccessToken(token)).payload, status: "valid" };
	} catch (error) {
		logger.error(error, "Invalid access token");
		if (error instanceof JWTExpired) {
			return { payload: error.payload, status: "expired" };
		}
		return { status: "invalid" };
	}
}
