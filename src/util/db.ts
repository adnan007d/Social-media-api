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
import { eq, sql, desc, and } from "drizzle-orm";
import logger from "./logger";
import redis from "@/util/redis";
import type { PostCreateBody, CommentBody, PaginationQuery, PostQuery } from "./validations";
import env from "@/env";

// --- Users ---

export async function selectUserById(id: string) {
	return await db.execute(sql`
SELECT u.id, u.email, u.role,
      u.username,
      u.email_verified, i.url as "image"
FROM users u
LEFT JOIN LATERAL (
    SELECT url
    FROM images
    WHERE ref_id = u.id
      AND type = 'profile'
    ORDER BY created_at DESC
    LIMIT 1
) i ON true
WHERE u.id = ${id}`);
}

export async function updateUserInDB(
	user_id: string,
	data: Partial<typeof usersTable.$inferInsert>
) {
	return await db.update(usersTable).set(data).where(eq(usersTable.id, user_id));
}

export async function insertUserInDB(data: typeof usersTable.$inferInsert) {
	return await db
		.insert(usersTable)
		.values(data)
		.returning({ id: usersTable.id, username: usersTable.username });
}

export async function selectUserByEmail(email: string) {
	return await db.query.usersTable.findFirst({
		columns: { id: true, email: true, role: true, password: true },
		where: eq(usersTable.email, email)
	});
}

export async function rotateRefreshTokenInDB(values: InsertRefreshToken, old_token?: string) {
	// If old refresh token is provided, delete
	const deletePromise = old_token ? deleteOldRefreshTokens(old_token, values.user_id) : undefined;

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

export async function deleteOldRefreshTokens(old_token: string, user_id: string) {
	await db
		.delete(refreshTokensTable)
		.where(
			and(eq(refreshTokensTable.refresh_token, old_token), eq(refreshTokensTable.user_id, user_id))
		);
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

export async function selectPostFromDB(postId: string) {
	const posts = await redis.get(`posts:${postId}`);
	if (posts) {
		return JSON.parse(posts);
	}

	const [result] = await db.execute(sql`
SELECT
    p.id as id, p.content as content,
    (p.updated_at > p.created_at) as "edited",
    p.created_at as created_at,
    pi.url as "image",
    u.username, ui.url as "user_profile",
    (SELECT count(*) FROM likes WHERE post_id = p.id)::int as "likes",
    (SELECT count(*) FROM comments WHERE post_id = p.id)::int as "comments"
FROM
posts p
INNER JOIN users u on p.user_id = u.id
LEFT JOIN LATERAL (
        SELECT url FROM images
        WHERE ref_id = p.id AND type = 'post'
        ORDER BY created_at DESC
        LIMIT 1
) as pi ON true
LEFT JOIN LATERAL (
        SELECT url FROM images
        WHERE ref_id = p.user_id AND type = 'profile'
        ORDER BY created_at DESC
        LIMIT 1
) as ui ON true
WHERE p.id = ${postId}`);

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

export async function selectPostsFromDB(params: PostQuery) {
	const { limit, offset, user_id } = params;

	const cache = await redis.get(`posts:query:${JSON.stringify(params)}`);

	if (cache) {
		return JSON.parse(cache);
	}

	const result = await db.execute(sql`
SELECT
    p.id as id, p.content as content,
    (p.updated_at > p.created_at) as "edited",
    p.created_at as "created_at",
    pi.url as "image",
    u.username as usename,
    ui.url as "user_profile",
    (SELECT count(*) FROM likes WHERE post_id = p.id)::int as "likes",
    (SELECT count(*) FROM comments WHERE post_id = p.id)::int as "comments"
FROM
posts p
INNER JOIN users u on p.user_id = u.id
LEFT JOIN LATERAL (
        SELECT url FROM images
        WHERE ref_id = p.id AND type = 'post'
        ORDER BY created_at DESC
        LIMIT 1
) as pi ON true
LEFT JOIN LATERAL (
        SELECT url FROM images
        WHERE ref_id = p.user_id AND type = 'profile'
        ORDER BY created_at DESC
        LIMIT 1
) as ui ON true
${user_id ? sql`WHERE p.user_id = ${user_id}` : sql``}
ORDER BY p.created_at DESC
OFFSET ${offset}
LIMIT ${limit};
`);

	if (result) {
		await redis.set(
			`posts:query:${JSON.stringify(params)}`,
			JSON.stringify(result),
			env.NODE_ENV !== "test" ? { EX: 1 * 60 } : undefined
		);
	}

	return result;
}

export async function insertPostInDB(body: PostCreateBody, userId: string) {
	const [post] = await db
		.insert(postsTable)
		.values({ ...body, user_id: userId })
		.returning({
			id: postsTable.id,
			content: postsTable.content,
			user_id: postsTable.user_id
		});

	return post;
}

export async function updatePostInDB(body: PostCreateBody, userId: string, postId: string) {
	if (Object.keys(body).length === 0) {
		return { id: postId, user_id: userId };
	}

	const [post] = await db
		.update(postsTable)
		.set(body)
		.where(and(eq(postsTable.id, postId), eq(postsTable.user_id, userId)))
		.returning({
			id: postsTable.id,
			content: postsTable.content,
			user_id: postsTable.user_id
		})
		.execute();
	return post;
}

export async function deletePostInDB(post_id: string, user_id: string) {
	return await db
		.delete(postsTable)
		.where(and(eq(postsTable.id, post_id), eq(postsTable.user_id, user_id)))
		.returning({
			id: postsTable.id
		})
		.execute();
}

// ---- Images ----

export async function insertImageInDB(data: typeof imagesTable.$inferInsert) {
	return await db.insert(imagesTable).values(data).returning({ id: imagesTable.id });
}

export async function updateImageInDB(
	post_id: string,
	data: Partial<typeof imagesTable.$inferInsert>
) {
	return await db
		.update(imagesTable)
		.set(data)
		.where(eq(imagesTable.ref_id, post_id))
		.returning({ id: imagesTable.id });
}

// ---- Comments ----
type CreateCommentInDB = {
	body: CommentBody;
	user_id: string;
	post_id: string;
};

export async function insertCommentInDB(params: CreateCommentInDB) {
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

export async function selectCommentsForPostDB(postId: string, params: PaginationQuery) {
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
			edited: sql`(${commentTable.updated_at} > ${commentTable.created_at})`,
			created_at: commentTable.created_at
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

// ---- Likes ----

export async function insertLike(post_id: string, user_id: string) {
	return await db
		.insert(likesTable)
		.values({
			user_id,
			post_id
		})
		.onConflictDoNothing({
			target: [likesTable.user_id, likesTable.post_id]
		});
}

export async function deleteLike(post_id: string, user_id: string) {
	return await db
		.delete(likesTable)
		.where(and(eq(likesTable.user_id, user_id), eq(likesTable.post_id, post_id)))
		.returning({ id: likesTable.id })
		.execute();
}
