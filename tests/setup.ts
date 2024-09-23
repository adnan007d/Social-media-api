import type { GlobalSetupContext } from "vitest/node";
import * as schema from "@/db/schema";
import { createTestDB, generatePosts, generateUsers, migrateDB } from "./testUtil";

export default async function setup({ provide }: GlobalSetupContext) {
	const testDb = await createTestDB();

	const { db, sql } = await migrateDB(testDb);

	const users = generateUsers(10);
	const posts = generatePosts(users.map((user) => user.id!));

	const usersFromDB = await db.insert(schema.usersTable).values(users).returning();
	const postsFromDB = await db.insert(schema.postsTable).values(posts).returning();
	console.log(`Inserted ${users.length} users and ${posts.length} posts`);

	provide("users", usersFromDB);
	provide("posts", postsFromDB);

	await sql.end();

	return async () => {
		await import("./testUtil.js").then((d) => d.sql).then((sql) => sql.end());
	};
}

declare module "vitest" {
	export interface ProvidedContext {
		users: schema.SelectUser[];
		posts: schema.SelectPost[];
	}
}
