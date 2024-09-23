import type { InsertPost, InsertUser } from "@/db/schema";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import env from "@/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "@/db/schema";

export function generateUsername() {
	return Math.random().toString(36).substring(7);
}

export function generateEmail() {
	return `${generateUsername()}@example.com`;
}

export function generateUsers(n: number) {
	const users: InsertUser[] = [];
	for (let i = 0; i < n; i++) {
		users.push({
			id: randomUUID(),
			username: generateUsername(),
			email: generateEmail(),
			password: bcrypt.hashSync(testPassword, 10),
			role: "user",
			email_verified: false
		});
	}
	return users;
}

export function generatePosts(user_ids: string[]) {
	const posts: InsertPost[] = [];
	for (const user_id of user_ids) {
		posts.push({
			user_id,
			content: "This is a test post"
		});
	}
	return posts;
}

const testDb = `test_${env.DB_NAME}`;
export async function createTestDB() {
	const _sql = postgres({
		database: env.DB_NAME,
		host: env.DB_HOST,
		port: env.DB_PORT,
		username: env.DB_USER,
		password: env.DB_PASS
	});

	await _sql.unsafe(`DROP DATABASE IF EXISTS "${testDb}"`);
	await _sql.unsafe(`CREATE DATABASE "test_${env.DB_NAME}"`);
	console.log("Test Database created");
	await _sql.end();
	return testDb;
}

export async function migrateDB(testDb: string) {
	const sql = postgres({
		database: testDb,
		host: env.DB_HOST,
		port: env.DB_PORT,
		username: env.DB_USER,
		password: env.DB_PASS
	});
	const db = drizzle(sql, { schema });
	console.log("Test Database connected");

	console.log("Migrating test database");
	await migrate(db, { migrationsFolder: "./migrations" });
	console.log("Database migrated");
	return { sql, db };
}

export const sql = postgres({
	database: testDb,
	host: env.DB_HOST,
	port: env.DB_PORT,
	username: env.DB_USER,
	password: env.DB_PASS
});
export const db = drizzle(sql, { schema });

export const testPassword = "WooW@123";
