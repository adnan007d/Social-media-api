import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { APIError } from "@/util/util";
import { deleteLike, insertLike } from "@/util/db";

export async function likePost(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const postId = z.string().uuid().parse(req.params.postId);
		await insertLike(postId, user.id);

		return res.json({ message: "Liked" });
	} catch (error) {
		return next(error);
	}
}

export async function unlikePost(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const postId = z.string().uuid().parse(req.params.postId);
		const [like] = await deleteLike(postId, user.id);
		if (!like) {
			return next(new APIError(404, "Like not found"));
		}
		return res.json({ message: "Unliked" });
	} catch (error) {
		return next(error);
	}
}
