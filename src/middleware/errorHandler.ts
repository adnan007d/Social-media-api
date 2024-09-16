import type { Request, Response, NextFunction } from "express";
import { APIError } from "@/util/util";
import logger from "@/util/logger";

/**
 * For handling errors in the application
 * Should be the last middleware in the middleware chain to catch all errors
 * For zod errors it will return the first error message in the array
 * and there will be a zodError field which will return the formatted error
 * refer {@link https://zod.dev/ERROR_HANDLING?id=formatting-errors here}
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
	if (err instanceof APIError) {
		return res.status(err.status).json({
			message: err.message,
			zodError: err.zodError
		});
	} else {
		logger.error(err);
		return res.status(500).json({
			message: "Internal server error"
		});
	}
}
