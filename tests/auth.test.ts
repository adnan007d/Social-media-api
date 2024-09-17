import app from "@/app";
import inject from "light-my-request";
import { describe, it, expect } from "vitest";
import { generateEmail, generateUsername, testPassword } from "./testUtil";
import db from "@/db";
import { usersTable } from "@/db/schema";
import { sql } from "drizzle-orm";

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
