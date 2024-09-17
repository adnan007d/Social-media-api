import Queue from "bee-queue";
import { rotateRefreshTokenInDB } from "./db";

export const dbQueue = new Queue<Parameters<typeof rotateRefreshTokenInDB>>("ROTATE_REFRESH_TOKEN");

dbQueue.process(async (job) => {
	return rotateRefreshTokenInDB(...job.data);
});
