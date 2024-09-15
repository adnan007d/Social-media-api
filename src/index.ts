import app from "@/app";
import env from "@/env";
import { dbCleanup } from "./db";

async function main() {
	app.listen(env.PORT, () => console.log(`Listening on port ${6969}`));
}

main().catch((error) => {
	console.error(error);
	dbCleanup();
	process.exit(1);
});
