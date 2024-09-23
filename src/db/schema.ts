import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uuid
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const imageTypeEnum = pgEnum("image_type", ["profile", "post"]);

export const imagesTable = pgTable("images", {
	id: uuid("id").defaultRandom().primaryKey(),
	type: imageTypeEnum("type").notNull(),
	url: text("url").notNull(),
	public_id: text("public_id").notNull(),
	// ref_id is the id of the user or post or any future entity
	ref_id: uuid("ref_id").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const usersTable = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	role: roleEnum("role").default("user").notNull(),
	email_verified: boolean("email_verified").default(false),
	username: text("username").notNull().unique(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const refreshTokensTable = pgTable("refresh_tokens", {
	id: uuid("id").defaultRandom().primaryKey(),
	user_id: uuid("user_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	refresh_token: text("refresh_token").notNull(),
	device: text("device"),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	// 30 days after updating time
	expires_at: timestamp("expires_at", { withTimezone: true })
		.notNull()
		.default(sql`now() + INTERVAL '30 days'`)
});

export const postsTable = pgTable("posts", {
	id: uuid("id").defaultRandom().primaryKey(),
	user_id: uuid("user_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	content: text("content").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const likesTable = pgTable(
	"likes",

	{
		id: uuid("id").defaultRandom().primaryKey(),
		user_id: uuid("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		post_id: uuid("post_id")
			.notNull()
			.references(() => postsTable.id, { onDelete: "cascade" }),
		created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		unique: unique("one_like_per_post").on(t.user_id, t.post_id)
	})
);

export const commentTable = pgTable("comments", {
	id: uuid("id").defaultRandom().primaryKey(),
	user_id: uuid("user_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	post_id: uuid("post_id")
		.notNull()
		.references(() => postsTable.id, { onDelete: "cascade" }),
	content: text("content").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const postRelations = relations(postsTable, ({ one, many }) => ({
	user: one(usersTable, {
		fields: [postsTable.user_id],
		references: [usersTable.id]
	}),
	likes: many(likesTable),
	comments: many(commentTable)
}));

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type InsertRefreshToken = typeof refreshTokensTable.$inferInsert;
export type SelectRefreshToken = typeof refreshTokensTable.$inferSelect;

export type InsertImage = typeof imagesTable.$inferInsert;
export type SelectImage = typeof imagesTable.$inferSelect;

export type InsertPost = typeof postsTable.$inferInsert;
export type SelectPost = typeof postsTable.$inferSelect;

export type InsertLike = typeof likesTable.$inferInsert;
export type SelectLike = typeof likesTable.$inferSelect;

export type InsertComment = typeof commentTable.$inferInsert;
export type SelectComment = typeof commentTable.$inferSelect;
