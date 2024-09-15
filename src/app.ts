import express from "express";
import env from "@/env";
import db from "@/db";
import { sql } from "drizzle-orm";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

export default app;
