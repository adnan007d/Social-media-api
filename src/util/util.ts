import type { inferFormattedError } from "zod";
import bcryt from "bcrypt";
import { type CookieOptions } from "express";

export class APIError extends Error {
	constructor(
		public status: number,
		public override message: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		public zodError?: inferFormattedError<any>
	) {
		super(message);
	}
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
	return bcryt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string) {
	return bcryt.compare(password, hash);
}

export const COOKIE_OPTIONS: CookieOptions = {
	httpOnly: true,
	sameSite: "strict",
	secure: process.env.NODE_ENV === "production",
	maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
};
