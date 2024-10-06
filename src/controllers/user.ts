import { type InsertUser } from "@/db/schema";
import { uploadStream } from "@/util/cloudinary";
import { insertImageInDB, selectUserById, updateUserInDB } from "@/util/db";
import logger from "@/util/logger";
import { deleteOldProfileImagesQueue } from "@/util/queue";
import { APIError } from "@/util/util";
import { type UserUpdateBody } from "@/util/validations";
import type { Response, NextFunction, Request } from "express";
import { PostgresError } from "postgres";

export async function getMe(req: Request, res: Response, next: NextFunction) {
	const reqUser = req.user as NonNullable<Request["user"]>;
	try {
		const user = await selectUserById(reqUser.id);
		return res.json(user[0]);
	} catch (error) {
		return next(error);
	}
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user!;

		const body = req.body as UserUpdateBody;

		const updates: Partial<InsertUser> = {};

		// If username exists update it
		if (body.username) {
			updates.username = body.username;
		}

		let imageUrl: string | undefined;
		if (req.file) {
			const imageData = await uploadStream(req.file, {
				public_id: "profile/" + user.id,
				invalidate: true
			});

			await insertImageInDB({
				public_id: imageData.public_id,
				url: imageData.url,
				ref_id: user.id,
				type: "profile"
			});
			imageUrl = imageData.url;

			deleteOldProfileImagesQueue.createJob(user.id).save();
		}

		// only update image if it has changed
		if (Object.keys(updates).length > 0) {
			await updateUserInDB(user.id, updates);
		}
		return res.json({
			username: body.username,
			imageUrl: imageUrl
		});
	} catch (error) {
		logger.error(error);
		if (error instanceof PostgresError) {
			if (error.code === "23505") {
				return next(new APIError(400, "Username already exists"));
			}
		}

		return next(error);
	}
}
