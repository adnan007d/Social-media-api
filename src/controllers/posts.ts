import { uploadStream } from "@/util/cloudinary";
import {
	deletePostInDB,
	insertImageInDB,
	insertPostInDB,
	selectPostFromDB,
	selectPostsFromDB,
	updateImageInDB,
	updatePostInDB
} from "@/util/db";
import logger from "@/util/logger";
import { APIError } from "@/util/util";
import { postQuerySchema, type PostCreateBody } from "@/util/validations";
import type { NextFunction, Request, Response } from "express";
import z from "zod";

export async function getPosts(req: Request, res: Response, next: NextFunction) {
	try {
		const query = postQuerySchema.parse(req.query);
		const posts = await selectPostsFromDB(query);
		return res.json(posts);
	} catch (error) {
		return next(error);
	}
}

export async function getPost(req: Request, res: Response, next: NextFunction) {
	try {
		const postId = z.string().uuid().parse(req.params.id);

		const post = await selectPostFromDB(postId);

		return res.json(post);
	} catch (error) {
		return next(error);
	}
}

export async function createPost(req: Request, res: Response, next: NextFunction) {
	try {
		const body = req.body;
		const user = req.user as NonNullable<Request["user"]>;

		const post = await insertPostInDB(body, user.id);

		if (!post) {
			throw new APIError(500, "Post creation failed");
		}

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

		if (!post) {
			throw new APIError(404, "Post not found");
		}

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
		const [post] = await deletePostInDB(postId, user.id);

		if (!post) {
			return next(new APIError(404, "Post not found"));
		}
		return res.json(post);
	} catch (error) {
		return next(error);
	}
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

	const [image] = await insertImageInDB({
		id: imageData.public_id,
		url: imageData.url,
		type: "post",
		ref_id: postId,
		public_id: imageData.public_id
	});

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
	const [image] = await updateImageInDB(postId, {
		url: imageData.url,
		public_id: imageData.public_id
	});
	if (!image) {
		logger.error({ userId, postId }, "Image update failed image object was empty");
		throw new APIError(500, "Image update failed image object was empty");
	}
	return image;
}
