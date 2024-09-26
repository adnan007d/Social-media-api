import { expect, describe, it, inject as vitestInject, beforeAll, afterAll } from "vitest";
import inject from "light-my-request";
import app from "@/app";
import { testPassword } from "./testUtil";
import redis from "@/util/redis";

const users = vitestInject("users");
describe("posts", async () => {
	let postId: string;
	beforeAll(async () => await redis.connect());
	afterAll(async () => await redis.disconnect());

	const user = users[Math.floor(Math.random() * users.length)]!;
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
		for (let i = 0; i < 20; i++) {
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
		}
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
		const user1 = users.find((u) => u.id !== user.id)!;

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
		const user1 = users.find((u) => u.id !== user.id)!;

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
