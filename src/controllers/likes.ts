import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import db from "@/db";
import { likesTable } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { APIError } from "@/util/util";

export async function likePost(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const postId = z.string().uuid().parse(req.params.postId);
		await db.execute(sql`
INSERT INTO ${likesTable} (user_id, post_id)
VALUES (${user.id}, ${postId})
ON CONFLICT (user_id, post_id) DO NOTHING
RETURNING id
    `);

		return res.json({ message: "Liked" });
	} catch (error) {
		return next(error);
	}
}

export async function unlikePost(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user as NonNullable<Request["user"]>;
		const postId = z.string().uuid().parse(req.params.postId);
		const [like] = await db
			.delete(likesTable)
			.where(and(eq(likesTable.user_id, user.id), eq(likesTable.post_id, postId)))
			.returning({
				id: likesTable.id
			})
			.execute();
		if (!like) {
			return next(new APIError(404, "Like not found"));
		}
		return res.json({ message: "Unliked" });
	} catch (error) {
		return next(error);
	}
}
