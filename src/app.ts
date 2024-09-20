import express from "express";
import env from "@/env";
import db from "@/db";
import { sql } from "drizzle-orm";
import authRouter from "@/routes/auth";
import userRouter from "@/routes/user";
import postsRouter from "@/routes/posts";
import commentsRouter from "@/routes/comment";

import { requestLogger } from "@/middleware/requestLogger";
import { errorHandler } from "@/middleware/errorHandler";

// @ts-expect-error - No need for types
import cookieParser from "cookie-parser";

const app = express();

app.use(cookieParser());
app.use(requestLogger(env.NODE_ENV === "development"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/posts", postsRouter);
app.use("/comments", commentsRouter);

app.get("/", (_req, res) => {
	res.send("Hello World");
});

app.get("/db_check", async (_req, res) => {
	if (env.NODE_ENV === "development") {
		const data = await db.execute(sql`SELECT * FROM VERSION()`);
		return res.json(data);
	}
	return res.json("DB check is only available in development mode");
});

app.use(errorHandler);

export default app;
