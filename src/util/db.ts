import db from "@/db";
import {
	commentTable,
	imagesTable,
	type InsertRefreshToken,
	likesTable,
	postsTable,
	refreshTokensTable,
	usersTable
} from "@/db/schema";
import { eq, sql, desc, count, and } from "drizzle-orm";
import logger from "./logger";
import redis from "@/util/redis";
import { type CommentBody, type PaginationQuery, type PostQuery } from "./validations";
import { aliasedTable } from "drizzle-orm";
import env from "@/env";

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

	const userImageTable = aliasedTable(imagesTable, "user_image");
	const [result] = await db
		.select({
			id: postsTable.id,
			user_id: postsTable.user_id,
			content: postsTable.content,
			created_at: postsTable.created_at,
			updated_at: postsTable.updated_at,
			likes: count(likesTable.id).mapWith(Number).as("likes"),
			comments: count(commentTable.id).mapWith(Number).as("comments"),
			image: imagesTable.url,
			username: usersTable.username,
			user_profile: userImageTable.url
		})
		.from(postsTable)
		.where(eq(postsTable.id, postId))
		.innerJoin(usersTable, eq(postsTable.user_id, usersTable.id))
		.leftJoin(imagesTable, and(eq(imagesTable.type, "post"), eq(imagesTable.ref_id, postsTable.id)))
		.leftJoin(
			userImageTable,
			and(eq(userImageTable.type, "profile"), eq(userImageTable.ref_id, postsTable.user_id))
		)
		.leftJoin(likesTable, eq(postsTable.id, likesTable.post_id))
		.leftJoin(commentTable, eq(postsTable.id, commentTable.post_id))
		.groupBy(postsTable.id, imagesTable.url, usersTable.username, userImageTable.url);

	if (result) {
		await redis.set(
			`posts:${postId}`,
			JSON.stringify(result),
			env.NODE_ENV !== "test" ? { EX: 1 * 60 } : undefined
		);
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

	const userImageTable = aliasedTable(imagesTable, "user_image");

	const query = db
		.select({
			id: postsTable.id,
			user_id: postsTable.user_id,
			content: postsTable.content,
			created_at: postsTable.created_at,
			updated_at: postsTable.updated_at,
			likes: count(likesTable.id).mapWith(Number).as("likes"),
			comments: count(commentTable.id).mapWith(Number).as("comments"),
			image: imagesTable.url,
			username: usersTable.username,
			user_profile: userImageTable.url
		})
		.from(postsTable)
		.innerJoin(usersTable, eq(postsTable.user_id, usersTable.id))
		.leftJoin(imagesTable, and(eq(imagesTable.type, "post"), eq(imagesTable.ref_id, postsTable.id)))
		.leftJoin(
			userImageTable,
			and(eq(userImageTable.type, "profile"), eq(userImageTable.ref_id, postsTable.user_id))
		)
		.leftJoin(likesTable, eq(postsTable.id, likesTable.post_id))
		.leftJoin(commentTable, eq(postsTable.id, commentTable.post_id))
		.groupBy(postsTable.id, imagesTable.url, usersTable.username, userImageTable.url)
		.orderBy(desc(postsTable.created_at))
		.limit(limit)
		.offset(offset);
	if (user_id) {
		query.where(eq(postsTable.user_id, user_id));
	}
	const result = await query.execute();

	if (result) {
		await redis.set(
			`posts:query:${JSON.stringify(params)}`,
			JSON.stringify(result),
			env.NODE_ENV !== "test" ? { EX: 1 * 60 } : undefined
		);
	}

	return result;
}

type CreateCommentInDB = {
	body: CommentBody;
	user_id: string;
	post_id: string;
};

export async function createCommentInDB(params: CreateCommentInDB) {
	const { body, user_id, post_id } = params;
	const [comment] = await db
		.insert(commentTable)
		.values({ ...body, user_id, post_id })
		.returning({
			id: commentTable.id,
			content: commentTable.content,
			user_id: commentTable.user_id,
			post_id: commentTable.post_id,
			created_at: commentTable.created_at,
			updated_at: commentTable.updated_at
		})
		.execute();
	return comment;
}

export async function deleteCommentInDB(comment_id: string, user_id: string) {
	// Author and the post owner can delete the comment
	const [comment] = await db.execute(sql`
DELETE FROM ${commentTable}
WHERE ${commentTable.id} = ${comment_id} and (
  ${commentTable.user_id} = ${user_id} or ${user_id} in (
    SELECT ${postsTable.user_id}
    FROM ${postsTable}
    WHERE ${postsTable.id} = ${commentTable.post_id}
    )
)
RETURNING ${commentTable.id}
`);
	return comment;
}

export async function getCommentsForPostDB(postId: string, params: PaginationQuery) {
	const { limit, offset } = params;

	const redisKey = `comments:${postId}:${JSON.stringify(params)}`;

	const cache = await redis.get(redisKey);

	if (cache) {
		return JSON.parse(cache);
	}

	const comments = await db
		.select({
			id: commentTable.id,
			user_id: commentTable.user_id,
			post_id: commentTable.post_id,
			content: commentTable.content,
			username: usersTable.username,
			user_profile: imagesTable.url,
			created_at: commentTable.created_at,
			updated_at: commentTable.updated_at
		})
		.from(commentTable)
		.where(eq(commentTable.post_id, postId))
		.innerJoin(usersTable, eq(usersTable.id, commentTable.user_id))
		.leftJoin(imagesTable, eq(imagesTable.ref_id, commentTable.user_id))
		.orderBy(desc(commentTable.created_at))
		.limit(limit)
		.offset(offset)
		.execute();

	if (comments) {
		await redis.set(
			redisKey,
			JSON.stringify(comments),
			env.NODE_ENV !== "test" ? { EX: 1 * 60 } : undefined
		);
	}

	return comments;
}
