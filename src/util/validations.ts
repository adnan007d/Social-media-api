import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "@/db/schema";

const insertUserSchema = createInsertSchema(usersTable);

export const signUpSchema = z.object({
	username: z
		.string()
		.min(3)
		.max(255)
		.regex(/^[a-zA-Z0-9_.]+$/, "Only alphabets, numbers, underscores and dots are allowed"),
	email: z.string().email("Invalid email address"),
	role: insertUserSchema.shape.role.default("user"),
	password: z
		.string()
		.min(8, "Password should be atleast 8 characters")
		.regex(/.*[a-z].*/, "Must contain one lowercase character")
		.regex(/.*[A-Z].*/, "Must contain one uppercase character")
		.regex(/.*[0-9].*/, "Must contain one number")
		.regex(/.*[!@#$%^&*(),.?":{}|<>].*/, "Must contain one special character")
});

export type SignUpBody = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
	email: z.string().email("Invalid email/password"),
	password: z.string().min(1, "Invalid email/password")
});

export type SignInBody = z.infer<typeof signInSchema>;

export const usersUpdateSchema = z.object({
	username: z.string().min(3).max(255).optional()
});

export type UserUpdateBody = z.infer<typeof usersUpdateSchema>;

export const paginationQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(50).default(12).catch(12),
	offset: z.coerce.number().int().nonnegative().default(0).catch(0)
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const postQuerySchema = z.object({
	limit: paginationQuerySchema.shape.limit,
	offset: paginationQuerySchema.shape.offset,
	user_id: z.string().uuid("invalid user").optional()
});

export type PostQuery = z.infer<typeof postQuerySchema>;

export const postCreateSchema = z.object({
	content: z
		.string()
		.min(1, "Post content is required")
		.max(1000, "Post content should be less than 1000 characters")
});

export type PostCreateBody = z.infer<typeof postCreateSchema>;

export const postCommentBodySchema = z.object({
	content: z
		.string()
		.min(1, "Comment content is required")
		.max(1000, "Comment content should be less than 1000 characters")
});

export type CommentBody = z.infer<typeof postCommentBodySchema>;
