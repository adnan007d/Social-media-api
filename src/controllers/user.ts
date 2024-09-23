import db from "@/db";
import { imagesTable, usersTable } from "@/db/schema";
import { uploadStream } from "@/util/cloudinary";
import logger from "@/util/logger";
import { deleteOldProfileImagesQueue } from "@/util/queue";
import { APIError } from "@/util/util";
import { type UserUpdateBody } from "@/util/validations";
import { eq, desc, and } from "drizzle-orm";
import type { Response, NextFunction, Request } from "express";
import { PostgresError } from "postgres";

export async function getMe(req: Request, res: Response, next: NextFunction) {
	const reqUser = req.user as NonNullable<Request["user"]>;
	try {
		const user = await db
			.select({
				id: usersTable.id,
				email: usersTable.email,
				username: usersTable.username,
				role: usersTable.role,
				email_verified: usersTable.email_verified,
				imageUrl: imagesTable.url
			})
			.from(usersTable)
			.where(eq(usersTable.id, reqUser.id))
			.leftJoin(
				imagesTable,
				and(eq(imagesTable.ref_id, usersTable.id), eq(imagesTable.type, "profile"))
			)
			.orderBy(desc(imagesTable.created_at))
			.limit(1);

		return res.json(user[0]);
	} catch (error) {
		return next(error);
	}
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user!;

		const body = req.body as UserUpdateBody;

		const updates: Partial<typeof usersTable.$inferInsert> = {};

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

			// If image record is not present create it
			// Update the user record as well
			await db
				.insert(imagesTable)
				.values({
					public_id: imageData.public_id,
					url: imageData.url,
					ref_id: user.id,
					type: "profile"
				})
				.returning({
					id: imagesTable.id
				});
			imageUrl = imageData.url;

			deleteOldProfileImagesQueue.createJob(user.id).save();

			await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
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
