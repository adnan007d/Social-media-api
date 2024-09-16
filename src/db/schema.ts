import { sql } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const imageTypeEnum = pgEnum("image_type", ["profile", "post"]);

export const imagesTable = pgTable("images", {
	id: uuid("id").primaryKey(),
	type: imageTypeEnum("type").notNull(),
	url: text("url").notNull(),
	// ref_id is the id of the user or post or any future entity
	ref_id: uuid("ref_id").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const usersTable = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	role: roleEnum("role").default("user").notNull(),
	email_verified: boolean("email_verified").default(false),
	profile_image: uuid("profile_image").references(() => imagesTable.id),
	username: text("username").notNull().unique(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const refreshTokensTable = pgTable("refresh_tokens", {
	id: uuid("id").defaultRandom().primaryKey(),
	user_id: uuid("user_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	refresh_token: text("refresh_token").notNull(),
	device: text("device"),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	// 30 days after updating time
	expires_at: timestamp("expires_at", { withTimezone: true })
		.notNull()
		.$onUpdateFn(() => sql`current_timestamp + interval '30 days'`)
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type InsertRefreshToken = typeof refreshTokensTable.$inferInsert;
export type SelectRefreshToken = typeof refreshTokensTable.$inferSelect;

export type InsertImage = typeof imagesTable.$inferInsert;
export type SelectImage = typeof imagesTable.$inferSelect;
