import app from "@/app";
import env from "@/env";
import { dbCleanup } from "./db";
import logger from "@/util/logger";
import redis from "@/util/redis";

async function main() {
	await redis.connect();
	app.listen(env.PORT, () => logger.info(`Listening on port ${6969}`));
}

async function cleanup() {
	await redis.disconnect();
	await dbCleanup();
}

main().catch((error) => {
	logger.error(error);
	cleanup().then(() => process.exit(1));
});
