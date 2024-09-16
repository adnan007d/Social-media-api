import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import env from "@/env";

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
