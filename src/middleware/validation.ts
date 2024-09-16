import type { AnyZodObject } from "zod";
import { APIError } from "@/util/util";
import type { Request, Response, NextFunction } from "express";

/**
 * Validates the req body and assignes the parsed body to req.body
 */
export function validateBody(schema: AnyZodObject) {
	return (req: Request, _res: Response, next: NextFunction) => {
		const parsedBody = schema.safeParse(req.body);

		if (parsedBody.success) {
			req.body = parsedBody.data;
			return next();
		}

		const firstError = parsedBody.error.errors[0];
		const message = `${firstError?.path.join(".")}: ${firstError?.message}`;
		return next(new APIError(400, message, parsedBody.error.format()));
	};
}
