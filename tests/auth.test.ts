import app from "@/app";
import inject from "light-my-request";
import { describe, it, expect, beforeEach } from "vitest";
import { generateEmail, generateUsername, testPassword } from "./testUtil";
import { refreshTokensTable, usersTable } from "@/db/schema";
import { eq, sql, ne } from "drizzle-orm";
import { SignJWT } from "jose";
import env from "@/env";
import { db } from "./testUtil";

describe("auth signup", () => {
	it("empty body", async () => {
		await inject(app)
			.post("/auth/signup")
			.then((res) => {
				expect(res.statusCode).toBe(400);
				expect(res.json().zodError).toBeTypeOf("object");
			});
	});

	it("invalid email", async () => {
		await inject(app)
			.post("/auth/signup")
			.body({ username: "woow", email: "invalid-email" })
			.then((res) => {
				expect(res.statusCode).toBe(400);
				expect(res.json().message).toBe("email: Invalid email address");
				expect(res.json().zodError.email._errors).toEqual(["Invalid email address"]);
			});
	});

	it("invalid username", async () => {
		await inject(app)
			.post("/auth/signup")
			.body({ username: "/7365-A" })
			.then((res) => {
				expect(res.statusCode).toBe(400);
				expect(res.json().message).toBe(
					"username: Only alphabets, numbers, underscores and dots are allowed"
				);
				expect(res.json().zodError.username._errors).toEqual([
					"Only alphabets, numbers, underscores and dots are allowed"
				]);
			});
	});

	it("invalid password", async () => {
		await inject(app)
			.post("/auth/signup")
			.body({ username: "woow", email: "check@mail.com", password: "" })
			.then((res) => {
				expect(res.statusCode).toBe(400);
				expect(res.json().message).toBe("password: Password should be atleast 8 characters");
				expect(res.json().zodError.password._errors).toEqual([
					"Password should be atleast 8 characters",
					"Must contain one lowercase character",
					"Must contain one uppercase character",
					"Must contain one number",
					"Must contain one special character"
				]);
			});
	});

	it("valid body", async () => {
		for (let i = 0; i < 20; i++) {
			const password = testPassword;
			await inject(app)
				.post("/auth/signup")
				.body({
					username: generateUsername(),
					email: generateEmail(),
					password
				})
				.then((res) => {
					expect(res.statusCode).toBe(201);
				});
		}
	});

	it("email already exists", async () => {
		const password = testPassword;
		const email = generateEmail();
		await inject(app).post("/auth/signup").body({
			username: generateUsername(),
			email,
			password
		});

		await inject(app)
			.post("/auth/signup")
			.body({
				username: generateUsername(),
				email,
				password
			})
			.then((res) => {
				expect(res.statusCode).toBe(400);
				expect(res.json().message).toBe("Email already exists");
			});
	});

	it("username already exists", async () => {
		const password = testPassword;
		const username = generateUsername();
		await inject(app).post("/auth/signup").body({
			username,
			email: generateEmail(),
			password
		});

		await inject(app)
			.post("/auth/signup")
			.body({
				username,
				email: generateEmail(),
				password
			})
			.then((res) => {
				expect(res.statusCode).toBe(400);
				expect(res.json().message).toBe("Username already taken");
			});
	});
});

describe("auth signin", () => {
	it("empty body", async () => {
		await inject(app)
			.post("/auth/signin")
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Invalid email/password");
			});
	});

	it("wrong email", async () => {
		await inject(app)
			.post("/auth/signin")
			.body({ email: generateEmail(), password: testPassword })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Invalid email/password");
			});
	});

	it("wrong password", async () => {
		const result = await db
			.select({
				email: usersTable.email
			})
			.from(usersTable)
			.orderBy(sql`RANDOM()`)
			.limit(1)
			.execute();

		if (!result[0]) {
			throw new Error("No user found");
		}

		const email = result[0].email;

		await inject(app)
			.post("/auth/signin")
			.body({ email, password: "wrong password" })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Invalid email/password");
			});
	});

	it("correct credentials", async () => {
		const result = await db
			.select({
				email: usersTable.email,
				password: usersTable.password
			})
			.from(usersTable)
			.orderBy(sql`RANDOM()`)
			.limit(1)
			.execute();

		if (!result[0]) {
			throw new Error("No user found");
		}

		const email = result[0].email;

		const password = testPassword;

		await inject(app)
			.post("/auth/signin")
			.body({ email, password })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json().accessToken).toBeTypeOf("string");
				expect(res.json().refreshToken).toBeTypeOf("string");
				expect(res.cookies.filter((cookie) => cookie.name === "refreshToken")[0]?.value).toBeTypeOf(
					"string"
				);
			});
	});
});

describe("check authentication", () => {
	let user: { email: string; password: string; id: string };
	let accessToken: string;
	let refreshToken: string;
	beforeEach(async () => {
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
		user = result[0];
		const { json } = await inject(app)
			.post("/auth/signin")
			.body({ email: user.email, password: testPassword });
		accessToken = json().accessToken;
		refreshToken = json().refreshToken;
	});
	it("successful", async () => {
		const email = user.email;
		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer ${accessToken}` })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json().email).toBe(email);
			});
	});

	it("invalid access token", async () => {
		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer invalid-access-token` })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Unauthorized");
			});
	});

	it("invalid access token valid refresh token", async () => {
		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer invalid-access-token` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Unauthorized");
			});
	});

	it("expired access token but valid refresh token", async () => {
		const expiredToken = await new SignJWT({ id: user.id, role: "user" })
			.setProtectedHeader({ alg: "HS256" })
			.setExpirationTime("1s")
			.sign(new TextEncoder().encode(env.JWT_ACCESS_TOKEN_SECRET));
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer ${expiredToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(200);
				expect(res.json().id).toBe(user.id);
			});
	});

	it("expired access token and invalid/expired refresh token", async () => {
		const expiredToken = await new SignJWT({ id: user.id, role: "user" })
			.setProtectedHeader({ alg: "HS256" })
			.setExpirationTime("1s")
			.sign(new TextEncoder().encode(env.JWT_ACCESS_TOKEN_SECRET));
		await new Promise((resolve) => setTimeout(resolve, 1000));
		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer ${expiredToken}` })
			.cookies({ refreshToken: "invalid-refresh-token" })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Unauthorized");
			});
	});

	it("expired access token and valid refresh token but deleted from database", async () => {
		const expiredToken = await new SignJWT({ id: user.id, role: "user" })
			.setProtectedHeader({ alg: "HS256" })
			.setExpirationTime("1s")
			.sign(new TextEncoder().encode(env.JWT_ACCESS_TOKEN_SECRET));
		await new Promise((resolve) => setTimeout(resolve, 1000));

		await db.delete(refreshTokensTable).where(eq(refreshTokensTable.refresh_token, refreshToken));

		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer ${expiredToken}` })
			.cookies({ refreshToken })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Unauthorized");
			});
	});

	it("[odd case] expired access token of user 1 and valid refreshToken of user 2", async () => {
		const result = await db
			.select({
				email: usersTable.email,
				password: usersTable.password,
				id: usersTable.id
			})
			.from(usersTable)
			.where(ne(usersTable.id, user.id))
			.orderBy(sql`RANDOM()`)
			.limit(1)
			.execute();
		if (!result[0]) {
			throw new Error("No user found");
		}
		const user2 = result[0];

		const expiredToken = await new SignJWT({ id: user.id, role: "user" })
			.setProtectedHeader({ alg: "HS256" })
			.setExpirationTime("1s")
			.sign(new TextEncoder().encode(env.JWT_ACCESS_TOKEN_SECRET));
		await new Promise((resolve) => setTimeout(resolve, 1000));
		const { json } = await inject(app)
			.post("/auth/signin")
			.body({ email: user2.email, password: testPassword });
		const refreshToken2 = json().refreshToken;

		await inject(app)
			.get("/users/me")
			.headers({ Authorization: `Bearer ${expiredToken}` })
			.cookies({ refreshToken: refreshToken2 })
			.then((res) => {
				expect(res.statusCode).toBe(401);
				expect(res.json().message).toBe("Unauthorized");
			});
	});
});
