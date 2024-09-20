import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "@/app";
import inject from "light-my-request";
import db from "@/db";
import { usersTable } from "@/db/schema";
import { sql } from "drizzle-orm";
import { testPassword } from "./testUtil";
import redis from "@/util/redis";

describe("comments", async () => {
	beforeAll(async () => {
		await redis.connect();
	});

	afterAll(async () => {
		await redis.disconnect();
	});

	const [user1, user2] = await db
		.select({
			id: usersTable.id,
			email: usersTable.email,
			password: usersTable.password
		})
		.from(usersTable)
		.orderBy(sql`RANDOM()`)
		.limit(2)
		.execute();

	if (!user1 || !user2) {
		throw new Error("No user found");
	}

	const { json: json1 } = await inject(app)
		.post("/auth/signin")
		.body({ email: user1.email, password: testPassword });

	const { json: json2 } = await inject(app)
		.post("/auth/signin")
		.body({ email: user2.email, password: testPassword });

	const accessToken1 = json1().accessToken;
	const refreshToken1 = json1().refreshToken;

	const accessToken2 = json2().accessToken;
	const refreshToken2 = json2().refreshToken;

	const post1 = await inject(app)
		.post("/posts")
		.body({ content: "Hello" })
		.headers({ Authorization: `Bearer ${accessToken1}` })
		.cookies({ refreshToken: refreshToken1 })
		.then((res) => {
			expect(res.statusCode).toBe(201);
			return res.json();
		});

	const post2 = await inject(app)
		.post("/posts")
		.body({ content: "World" })
		.headers({ Authorization: `Bearer ${accessToken2}` })
		.cookies({ refreshToken: refreshToken2 })
		.then((res) => {
			expect(res.statusCode).toBe(201);
			return res.json();
		});

	it("unauthorized", async () => {
		await inject(app)
			.post(`/comments/${post1.id}`)
			.then((res) => {
				expect(res.statusCode).toBe(401);
			});
	});

	it("Empty Body", async () => {
		await inject(app)
			.post(`/comments/${post1.id}`)
			.headers({ Authorization: `Bearer ${accessToken1}` })
			.cookies({ refreshToken: refreshToken1 })
			.then((res) => {
				expect(res.statusCode).toBe(400);
			});
	});

	// eslint-disable-next-line
	let user1CommentId1: string = "";
	// eslint-disable-next-line
	let user1CommentId2: string = "";
	let user2CommentId1: string = "";
	let user2CommentId2: string = "";

	it("successful", async () => {
		// user1 comment on post1 and post2
		await inject(app)
			.post(`/comments/${post1.id}`)
			.body({ content: "Hello" })
			.headers({ Authorization: `Bearer ${accessToken1}` })
			.cookies({ refreshToken: refreshToken1 })
			.then((res) => {
				expect(res.statusCode).toBe(201);
				expect(res.json().id).toBeTypeOf("string");
				expect(res.json().content).toBe("Hello");
				user1CommentId1 = res.json().id;
			});
		await inject(app)
			.post(`/comments/${post2.id}`)
			.body({ content: "World" })
			.headers({ Authorization: `Bearer ${accessToken1}` })
			.cookies({ refreshToken: refreshToken1 })
			.then((res) => {
				expect(res.statusCode).toBe(201);
				expect(res.json().id).toBeTypeOf("string");
				expect(res.json().content).toBe("World");
				user1CommentId2 = res.json().id;
			});

		// user2 comment on post1 and post2
		await inject(app)
			.post(`/comments/${post1.id}`)
			.body({ content: "World" })
			.headers({ Authorization: `Bearer ${accessToken2}` })
			.cookies({ refreshToken: refreshToken2 })
			.then((res) => {
				expect(res.statusCode).toBe(201);
				expect(res.json().id).toBeTypeOf("string");
				expect(res.json().content).toBe("World");
				user2CommentId1 = res.json().id;
			});
		await inject(app)
			.post(`/comments/${post2.id}`)
			.body({ content: "Hello" })
			.headers({ Authorization: `Bearer ${accessToken2}` })
			.cookies({ refreshToken: refreshToken2 })
			.then((res) => {
				expect(res.statusCode).toBe(201);
				expect(res.json().id).toBeTypeOf("string");
				expect(res.json().content).toBe("Hello");
				user2CommentId2 = res.json().id;
			});
	});

	it("get comments", async () => {
		await inject(app)
			.get(`/comments/${post1.id}`)
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json()).toBeTypeOf("object");
				expect(res.json()).toHaveProperty("length");
				expect(res.json().length).toBeLessThanOrEqual(12);
			});
	});

	it("user delete comment of another user", async () => {
		// user 1 tries to delete user2 comment on post2 which user 2 created
		await inject(app)
			.delete(`/comments/delete/${user2CommentId2}`)
			.headers({ Authorization: `Bearer ${accessToken1}` })
			.cookies({ refreshToken: refreshToken1 })
			.then((res) => {
				expect(res.statusCode).toBe(404);
			});
	});

	it("user delete comment", async () => {
		// user 1 delete his comment on post2
		await inject(app)
			.delete(`/comments/delete/${user1CommentId2}`)
			.headers({ Authorization: `Bearer ${accessToken1}` })
			.cookies({ refreshToken: refreshToken1 })
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});
	});

	it("author delete comment", async () => {
		// user 1 deletes user 2 comment on post1
		await inject(app)
			.delete(`/comments/delete/${user2CommentId1}`)
			.headers({ Authorization: `Bearer ${accessToken1}` })
			.cookies({ refreshToken: refreshToken1 })
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});
	});
});
