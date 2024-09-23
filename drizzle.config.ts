import { defineConfig } from "drizzle-kit";
import env from "./src/env";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "migrations",
	dialect: "postgresql",
	dbCredentials: {
		database: env.NODE_ENV === "production" ? env.DB_NAME : env.DEV_DB_NAME,
		host: env.DB_HOST,
		port: env.DB_PORT,
		user: env.DB_USER,
		password: env.DB_PASS
	}
});
