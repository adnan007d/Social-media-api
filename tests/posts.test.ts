import { expect, describe, it, beforeEach, afterAll } from "vitest";
import inject from "light-my-request";
import db from "@/db";
import { usersTable } from "@/db/schema";
import { sql, ne } from "drizzle-orm";
import app from "@/app";
import { testPassword } from "./testUtil";
import redis from "@/util/redis";

describe("posts", async () => {
	let postId: string;
	await redis.connect();

	afterAll(async () => {
		await redis.disconnect();
	});

	const result = await db
		.select({
			email: usersTable.email,
			password: usersTable.password,
			id: usersTable.id
		})
		.from(usersTable)
		.orderBy(sql`RANDOM()`)
		.limit(1)
		.execute();
	if (!result[0]) {
		throw new Error("No user found");
	}
	const user = result[0];
	const { json } = await inject(app)
		.post("/auth/signin")
		.body({ email: user.email, password: testPassword });
	const accessToken = json().accessToken;
	const refreshToken = json().refreshToken;

	it("unauthorized", async () => {
		await inject(app)
			.post("/posts")
			.body({ content: "World" })
			.then((res) => {
				expect(res.statusCode).toBe(401);
			});
	});

	it("Empty Body", async () => {
		await inject(app)
			.post("/posts")
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(400);
			});
	});

	it("successful", async () => {
		await inject(app)
			.post("/posts")
			.body({ content: "Hello" })
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(201);
				expect(res.json().id).toBeTypeOf("string");
				expect(res.json().content).toBe("Hello");
				postId = res.json().id;
			});
	});

	it("get posts", async () => {
		await inject(app)
			.get("/posts")
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json()).toBeTypeOf("object");
				expect(res.json()).toHaveProperty("length");
				expect(res.json().length).toBeLessThanOrEqual(12);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				res.json().forEach((post: any) => {
					expect(post).toHaveProperty("id");
					expect(post).toHaveProperty("content");
					expect(post).toHaveProperty("likes");
					expect(post).toHaveProperty("comments");
					expect(post).toHaveProperty("image");
					expect(post).toHaveProperty("username");
					expect(post).toHaveProperty("user_profile");
				});
			});
	});

	it("get post", async () => {
		await inject(app)
			.get(`/posts/${postId}`)
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json()).toBeTypeOf("object");
				expect(res.json()).toHaveProperty("id");
				expect(res.json()).toHaveProperty("content");
				expect(res.json()).toHaveProperty("likes");
				expect(res.json()).toHaveProperty("comments");
				expect(res.json()).toHaveProperty("image");
				expect(res.json()).toHaveProperty("username");
				expect(res.json()).toHaveProperty("user_profile");
			});
	});

	it("update post", async () => {
		console.log(postId);
		await inject(app)
			.patch(`/posts/${postId}`)
			.body({ content: "Hello World Updated" })
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json()).toBeTypeOf("object");
				expect(res.json()).toHaveProperty("id");
				expect(res.json()).toHaveProperty("content");
				expect(res.json().content).toBe("Hello World Updated");
			});
	});

	it("update someone else's post", async () => {
		const [user1] = await db
			.select({ id: usersTable.id, email: usersTable.email })
			.from(usersTable)
			.where(ne(usersTable.id, user.id))
			.limit(1)
			.execute();

		if (!user1) {
			throw new Error("No user found");
		}
		let newAccessToken: string | undefined;
		let newRefreshToken: string | undefined;
		await inject(app)
			.post("/auth/signin")
			.body({ email: user1.email, password: testPassword })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				newAccessToken = res.json().accessToken;
				newRefreshToken = res.json().refreshToken;
			});

		await inject(app)
			.patch(`/posts/${postId}`)
			.body({ content: "Hello World Updated" })
			.headers({ Authorization: `Bearer ${newAccessToken}` })
			.cookies({ refreshToken: newRefreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(404);
			});
	});

	it("delete someone else's post", async () => {
		const [user1] = await db
			.select({ id: usersTable.id, email: usersTable.email })
			.from(usersTable)
			.where(ne(usersTable.id, user.id))
			.limit(1)
			.execute();

		if (!user1) {
			throw new Error("No user found");
		}

		let newAccessToken: string | undefined;
		let newRefreshToken: string | undefined;

		await inject(app)
			.post("/auth/signin")
			.body({ email: user1.email, password: testPassword })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				newAccessToken = res.json().accessToken;
				newRefreshToken = res.json().refreshToken;
			});

		await inject(app)
			.delete(`/posts/${postId}`)
			.headers({ Authorization: `Bearer ${newAccessToken}` })
			.cookies({ refreshToken: newRefreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(404);
			});
	});
});
