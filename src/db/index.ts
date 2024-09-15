import env from "@/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Default max pool connections are 10
const sql = postgres({
	database: env.DB_NAME,
	host: env.DB_HOST,
	port: env.DB_PORT,
	username: env.DB_USER,
	password: env.DB_PASS
});

const db = drizzle(sql);

/**
 * Close the database connection
 */
export async function dbCleanup() {
	await sql.end();
}

export default db;
