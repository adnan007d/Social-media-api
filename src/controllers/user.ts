import db from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Response, NextFunction, AuthenticatedRequest } from "express";

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	try {
		const user = await db.query.usersTable.findFirst({
			where: eq(usersTable.id, req.user.id),
			columns: {
				id: true,
				email: true,
				username: true,
				role: true,
				profile_image: true,
				email_verified: true
			}
		});

		return res.json(user);
	} catch (error) {
		return next(error);
	}
}
