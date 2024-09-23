import { describe, it, expect, inject as vitestInject, beforeAll, afterAll } from "vitest";
import inject from "light-my-request";
import app from "@/app";
import { testPassword } from "./testUtil";
import redis from "@/util/redis";

const users = vitestInject("users");
const posts = vitestInject("posts");
describe("likes", async () => {
	const user = users[Math.floor(Math.random() * users.length)]!;

	beforeAll(async () => await redis.connect());
	afterAll(async () => await redis.disconnect());
	const { json } = await inject(app)
		.post("/auth/signin")
		.body({ email: user.email, password: testPassword });

	const accessToken = json().accessToken;
	const refreshToken = json().refreshToken;

	const post = posts[Math.floor(Math.random() * posts.length)]!;

	it("unauthorized", async () => {
		await inject(app)
			.post(`/likes/${post.id}`)
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
			.post(`/likes/${postId}`)
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
			.post(`/likes/${post.id}`)
			.headers({ Authorization: `Bearer ${accessToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
			});

		await inject(app)
			.delete(`/likes/${post.id}`)
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
