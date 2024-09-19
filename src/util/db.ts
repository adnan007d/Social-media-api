import db from "@/db";
import { imagesTable, type InsertRefreshToken, refreshTokensTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

export async function deleteOldProfileImages(ref_id: string) {
	// could use max instead of subquery but this is more performant
	// as don't calculate max for every row
	const deleteQuery = sql`
    DELETE FROM ${imagesTable}
    WHERE ${imagesTable.type} = 'profile'
      AND ${imagesTable.ref_id} = ${ref_id}
      AND ${imagesTable.created_at} < (
        SELECT created_at
        FROM (
          SELECT ${imagesTable.created_at} as created_at
          FROM ${imagesTable}
          WHERE ${imagesTable.type} = 'profile'
            AND ${imagesTable.ref_id} = ${ref_id}
          ORDER BY ${imagesTable.created_at} DESC
          LIMIT 1
        ) AS latest
      )
  `;

	try {
		const result = await db.execute(deleteQuery);
		logger.info(`Deleted ${result.length} old profile imagesTable for user ${ref_id}`);
		return result.length;
	} catch (error) {
		logger.error("Error deleting old profile imagesTable:", error);
		throw error;
	}
}
