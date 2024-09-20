import db from "@/db";
import { imagesTable, postsTable } from "@/db/schema";
import { uploadStream } from "@/util/cloudinary";
import { getPostFromDB, getPostsFromDB } from "@/util/db";
import logger from "@/util/logger";
import { APIError } from "@/util/util";
import { postQuerySchema, type PostCreateBody } from "@/util/validations";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import z from "zod";

export async function getPosts(req: Request, res: Response, next: NextFunction) {
	try {
		const query = postQuerySchema.parse(req.query);
		const posts = await getPostsFromDB(query);
		return res.json(posts);
	} catch (error) {
		return next(error);
	}
}

export async function getPost(req: Request, res: Response, next: NextFunction) {
	try {
		const postId = z.string().uuid().parse(req.params.id);

		const post = await getPostFromDB(postId);

		return res.json(post);
	} catch (error) {
		return next(error);
	}
}

export async function createPost(req: Request, res: Response, next: NextFunction) {
	try {
		const body = req.body as PostCreateBody;
		const user = req.user as NonNullable<Request["user"]>;

		const post = await createPostInDB(body, user.id);

		if (req.file) {
			const image = await handleImageInsert({ file: req.file, userId: user.id, postId: post.id });
			// @ts-expect-error I know it doesn't exist but its way better then destructuring
			post.imageUrl = image;
		}

		return res.status(201).json(post);
	} catch (error) {
		return next(error);
	}
}

export async function updatePost(req: Request, res: Response, next: NextFunction) {
	try {
		const body = req.body as PostCreateBody;
		const user = req.user as NonNullable<Request["user"]>;
		const postId = z.string().uuid().parse(req.params.id);

		const post = await updatePostInDB(body, user.id, postId);

		if (req.file) {
			const image = await handleImageUpdate({ file: req.file, userId: user.id, postId: post.id });
			// @ts-expect-error I know it doesn't exist but its way better then destructuring
			post.imageUrl = image;
		}
		return res.json(post);
	} catch (error) {
		return next(error);
	}
}

export async function deletePost(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const postId = z.string().uuid().parse(req.params.id);
		const [post] = await db
			.delete(postsTable)
			.where(and(eq(postsTable.id, postId), eq(postsTable.user_id, user.id)))
			.returning({
				id: postsTable.id
			})
			.execute();
		if (!post) {
			return next(new APIError(404, "Post not found"));
		}
		return res.json(post);
	} catch (error) {
		return next(error);
	}
}

async function createPostInDB(body: PostCreateBody, userId: string) {
	const [post] = await db
		.insert(postsTable)
		.values({ ...body, user_id: userId })
		.returning({
			id: postsTable.id,
			content: postsTable.content,
			user_id: postsTable.user_id
		});

	if (!post) {
		throw new APIError(500, "Post creation failed");
	}

	return post;
}

async function updatePostInDB(body: PostCreateBody, userId: string, postId: string) {
	if (Object.keys(body).length === 0) {
		return {};
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
	if (!post) {
		throw new APIError(404, "Post not found");
	}
	return post;
}

async function handleImageInsert(params: {
	file: Express.Multer.File;
	userId: string;
	postId: string;
}) {
	const { file, userId, postId } = params;
	const imageData = await uploadStream(file, {
		public_id: `post/${userId}/${postId}`,
		invalidate: true
	});
	const [image] = await db
		.insert(imagesTable)
		.values({
			id: imageData.public_id,
			url: imageData.url,
			type: "post",
			ref_id: postId,
			public_id: imageData.public_id
		})
		.returning({ id: imagesTable.id })
		.execute();
	if (!image) {
		logger.error({ userId, postId }, "Image creation failed image object was empty");
		throw new APIError(500, "Image creation failed image object was empty");
	}
	return image;
}

async function handleImageUpdate(params: {
	file: Express.Multer.File;
	userId: string;
	postId: string;
}) {
	const { file, userId, postId } = params;
	const imageData = await uploadStream(file, {
		public_id: `post/${userId}/${postId}`,
		invalidate: true
	});
	const [image] = await db
		.update(imagesTable)
		.set({ url: imageData.url })
		.where(eq(imagesTable.ref_id, postId))
		.returning({ id: imagesTable.id })
		.execute();
	if (!image) {
		logger.error({ userId, postId }, "Image update failed image object was empty");
		throw new APIError(500, "Image update failed image object was empty");
	}
	return image;
}
