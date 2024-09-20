import { describe, it, expect, afterAll, beforeAll } from "vitest";
import inject from "light-my-request";
import app from "@/app";
import db from "@/db";
import { likesTable, postsTable, usersTable } from "@/db/schema";
import { count, desc, sql } from "drizzle-orm";
import { testPassword } from "./testUtil";
import redis from "@/util/redis";

describe("likes", async () => {
	const [user] = await db
		.select({
			id: usersTable.id,
			email: usersTable.email,
			password: usersTable.password
		})
		.from(usersTable)
		.orderBy(sql`RANDOM()`)
		.limit(1)
		.execute();

	beforeAll(async () => {
		await redis.connect();
	});

	afterAll(async () => {
		await redis.disconnect();
	});

	if (!user) {
		throw new Error("No user found");
	}

	const { json } = await inject(app)
		.post("/auth/signin")
		.body({ email: user.email, password: testPassword });

	const accessToken = json().accessToken;
	const refreshToken = json().refreshToken;

	const [post] = await db
		.select({
			id: postsTable.id
		})
		.from(postsTable)
		.orderBy(sql`RANDOM()`)
		.limit(1)
		.execute();

	if (!post) {
		throw new Error("No post found");
	}

	it("unauthorized", async () => {
		await inject(app)
			.post(`/posts/${post.id}/like`)
			.then((res) => {
				expect(res.statusCode).toBe(401);
			});
	});

	it("successful like", async () => {
		const postId = await inject(app)
			.post(`/posts`)
			.body({ content: "Hello" })
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(201);
				return res.json().id;
			});

		await inject(app)
			.post(`/posts/${postId}/like`)
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});

		await inject(app)
			.get(`/posts/${postId}`)
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json().likes).toBe(1);
			});
	});

	it("successful unlike", async () => {
		const _post = await inject(app)
			.get(`/posts/${post.id}`)
			.then((res) => {
				expect(res.statusCode).toBe(200);
				return res.json();
			});

		if (!_post) {
			throw new Error("No post found");
		}

		await inject(app)
			.post(`/posts/${post.id}/like`)
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});

		await inject(app)
			.delete(`/posts/${post.id}/unlike`)
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});

		await inject(app)
			.get(`/posts/${post.id}`)
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json().likes).toBe(_post.likes);
			});
	});
});
