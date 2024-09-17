import db from "@/db";
import { type InsertRefreshToken, refreshTokensTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import logger from "./logger";

export async function rotateRefreshTokenInDB(values: InsertRefreshToken, old?: string) {
	// If old refresh token is provided, delete
	const deletePromise = old
		? db.delete(refreshTokensTable).where(eq(refreshTokensTable.refresh_token, old))
		: undefined;

	const [_, insertSetteled] = await Promise.allSettled([
		deletePromise,
		db.insert(refreshTokensTable).values({
			refresh_token: values.refresh_token,
			user_id: values.user_id,
			device: values.device ?? null
		})
	]);

	if (insertSetteled.status === "rejected") {
		logger.error(insertSetteled.reason);
	}
}
