import Queue from "bee-queue";
import { deleteOldProfileImages, rotateRefreshTokenInDB } from "./db";

export const dbQueue = new Queue<Parameters<typeof rotateRefreshTokenInDB>>("ROTATE_REFRESH_TOKEN");
export const deleteOldProfileImagesQueue = new Queue<string>("DELETE_OLD_PROFILE_IMAGES");

dbQueue.process(async (job) => {
	return rotateRefreshTokenInDB(...job.data);
});

deleteOldProfileImagesQueue.process(async (job) => {
	return deleteOldProfileImages(job.data);
});
