import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.coerce.number(),
	DB_HOST: z.string().min(1, "DB_HOST is required"),
	DB_PORT: z.coerce.number(),
	DB_USER: z.string().min(1, "DB_USER is required"),
	DB_PASS: z.string().min(1, "DB_PASS is required"),
	DB_NAME: z.string().min(1, "DB_NAME is required"),

	JWT_ACCESS_TOKEN_SECRET: z
		.string()
		.min(32, "JWT_ACCESS_TOKEN_SECRET must be at least 32 characters"),
	JWT_REFRESH_TOKEN_SECRET: z
		.string()
		.min(32, "JWT_REFRESH_TOKEN_SECRET is required and must be at least 32 characters"),

	LOG_FILE: z.string().default("logs.log"),

	CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
	CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
	CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

	REDIS_URL: z.string().min(1, "REDIS_URL is required")
});

const parsedEnv = envSchema.safeParse(process.env);

if (parsedEnv.error) {
	console.error(parsedEnv.error.errors);
	process.exit(1);
}

const env = parsedEnv.data;
export default env;
