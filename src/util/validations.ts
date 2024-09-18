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
	username: z.string().min(3).max(255).optional(),
	profile_image_id: z.string().uuid("invalid profile image id").optional()
});

export type UserUpdateBody = z.infer<typeof usersUpdateSchema>;
