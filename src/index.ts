import app from "@/app";
import env from "@/env";
import { dbCleanup } from "./db";
import logger from "@/util/logger";

async function main() {
	app.listen(env.PORT, () => logger.info(`Listening on port ${6969}`));
}

main().catch((error) => {
	logger.error(error);
	dbCleanup().then(() => process.exit(1));
});
