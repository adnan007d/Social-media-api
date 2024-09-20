import db from "@/db";
import {
	imagesTable,
	type InsertRefreshToken,
	likesTable,
	postsTable,
	refreshTokensTable
} from "@/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";
import logger from "./logger";
import redis from "@/util/redis";
import { type PostQuery } from "./validations";

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

export async function getPostFromDB(postId: string) {
	const posts = await redis.get(`posts:${postId}`);
	if (posts) {
		return JSON.parse(posts);
	}

	const [result] = await db
		.select({
			id: postsTable.id,
			user_id: postsTable.user_id,
			content: postsTable.content,
			created_at: postsTable.created_at,
			updated_at: postsTable.updated_at,
			likes: count(likesTable.id).mapWith(Number).as("likes")
		})
		.from(postsTable)
		.where(eq(postsTable.id, postId))
		.leftJoin(likesTable, eq(postsTable.id, likesTable.post_id))
		.groupBy(postsTable.id);

	if (result) {
		await redis.set(`posts:${postId}`, JSON.stringify(result), {
			EX: 1 * 60
		});
		return result;
	}

	return null;
}

export async function getPostsFromDB(params: PostQuery) {
	const { limit, offset, user_id } = params;

	const cache = await redis.get(`posts:query:${JSON.stringify(params)}`);

	if (cache) {
		return JSON.parse(cache);
	}

	const query = db
		.select({
			id: postsTable.id,
			user_id: postsTable.user_id,
			content: postsTable.content,
			created_at: postsTable.created_at,
			updated_at: postsTable.updated_at,
			likes: count(likesTable.id).mapWith(Number).as("likes")
		})
		.from(postsTable)
		.leftJoin(likesTable, eq(postsTable.id, likesTable.post_id))
		.groupBy(postsTable.id)
		.orderBy(desc(postsTable.created_at))
		.limit(limit)
		.offset(offset);
	if (user_id) {
		query.where(eq(postsTable.user_id, user_id));
	}
	const result = await query.execute();

	await redis.set(`posts:query:${JSON.stringify(params)}`, JSON.stringify(result), {
		EX: 1 * 60
	});

	return result;
}
