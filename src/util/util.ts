import type { inferFormattedError } from "zod";
import bcryt from "bcrypt";

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
