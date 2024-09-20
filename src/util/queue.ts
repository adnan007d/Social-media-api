import Queue from "bee-queue";
import { deleteOldProfileImages, rotateRefreshTokenInDB } from "./db";
import { createClient } from "redis";
import env from "@/env";
const redis = createClient({ url: env.REDIS_URL });
export const dbQueue = new Queue<Parameters<typeof rotateRefreshTokenInDB>>(
	"ROTATE_REFRESH_TOKEN",
	{ redis }
);
export const deleteOldProfileImagesQueue = new Queue<string>("DELETE_OLD_PROFILE_IMAGES", {
	redis
});

dbQueue.process(async (job) => {
	return rotateRefreshTokenInDB(...job.data);
});

deleteOldProfileImagesQueue.process(async (job) => {
	return deleteOldProfileImages(job.data);
});
