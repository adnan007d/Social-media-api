import { createCommentInDB, deleteCommentInDB, getCommentsForPostDB } from "@/util/db";
import { APIError } from "@/util/util";
import { paginationQuerySchema, type CommentBody } from "@/util/validations";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

export async function postComment(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const post_id = z.string().uuid().parse(req.params.postId);
		const body = req.body as CommentBody;
		const comment = await createCommentInDB({ body, user_id: user.id, post_id });
		if (!comment) {
			return next(new APIError(404, "Post not found"));
		}
		return res.status(201).json(comment);
	} catch (error) {
		return next(error);
	}
}

export async function deleteComment(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const comment_id = z.string().uuid("Invalid commentId").parse(req.params.commentId);
		const comment = await deleteCommentInDB(comment_id, user.id);

		if (!comment) {
			return next(new APIError(404, "Comment not found"));
		}

		return res.status(200).json({ message: "Deleted" });
	} catch (error) {
		return next(error);
	}
}

export async function getCommentsForPost(req: Request, res: Response, next: NextFunction) {
	try {
		const post_id = z.string().uuid().parse(req.params.postId);
		const query = paginationQuerySchema.parse(req.query);
		const comments = await getCommentsForPostDB(post_id, query);

		return res.status(200).json(comments);
	} catch (error) {
		return next(error);
	}
}
