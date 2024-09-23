import env from "@/env";
import * as schema from "@/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function getDbName() {
	switch (env.NODE_ENV) {
		case "test":
			return env.TEST_DB_NAME;
		case "development":
			return env.DEV_DB_NAME;
		default:
			return env.DB_NAME;
	}
}

// Default max pool connections are 10
const sql = postgres({
	database: getDbName(),
	host: env.DB_HOST,
	port: env.DB_PORT,
	username: env.DB_USER,
	password: env.DB_PASS
});

const db = drizzle(sql, { schema, logger: env.NODE_ENV === "development" });

/**
 * Close the database connection
 */
export async function dbCleanup() {
	await sql.end();
}

export default db;
