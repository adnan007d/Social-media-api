import logger from "@/util/logger";
import type { NextFunction, Request, Response } from "express";

export function requestLogger(enabled: boolean) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!enabled) {
			return next();
		}
		// logs the request method, status, url, and time
		const start = Date.now();
		res.on("finish", () => {
			const elapsed = Date.now() - start;
			logger.info(`${req.method} ${res.statusCode} ${req.url} ${elapsed}ms`);
		});
		return next();
	};
}
