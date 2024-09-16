import express from "express";
import env from "@/env";
import db from "@/db";
import { sql } from "drizzle-orm";
import authRouter from "@/routes/auth";
import { requestLogger } from "@/middleware/requestLogger";
import { errorHandler } from "@/middleware/errorHandler";

const app = express();

app.use(requestLogger(env.NODE_ENV === "development"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRouter);

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
