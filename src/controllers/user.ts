import db from "@/db";
import { imagesTable, usersTable } from "@/db/schema";
import { uploadStream } from "@/util/cloudinary";
import logger from "@/util/logger";
import { APIError } from "@/util/util";
import { type UserUpdateBody } from "@/util/validations";
import { eq } from "drizzle-orm";
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
			.leftJoin(imagesTable, eq(imagesTable.id, usersTable.profile_image));

		return res.json(user[0]);
	} catch (error) {
		return next(error);
	}
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.user!;

		const body = req.body as UserUpdateBody;

		// Updating username first as It can lead to error due to unique constrtaint
		// If username exists update it
		if (body.username) {
			await db
				.update(usersTable)
				.set({
					username: body.username
				})
				.where(eq(usersTable.id, user.id));
		}

		// No profile image to update return early
		if (!req.file) {
			return res.json({ username: body.username });
		}

		let image_id = body.profile_image_id;
		const imageData = await uploadStream(req.file, {
			public_id: "profile/" + user.id,
			invalidate: true
		});

		// If image record is not present create it
		// Update the user record as well
		if (!image_id && imageData) {
			const image = await db
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
			image_id = image[0]?.id;

			await db
				.update(usersTable)
				.set({
					profile_image: image_id!
				})
				.where(eq(usersTable.id, user.id));
		}

		return res.json({
			username: body.username,
			imageUrl: imageData?.url
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
