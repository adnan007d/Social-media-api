DROP INDEX IF EXISTS "idx_type_refid_created";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_created_at" ON "comments" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_post_id" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_user_id" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_ref_id_type_created_at" ON "images" USING btree ("ref_id","type","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "images_created_at" ON "images" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "likes_created_at" ON "likes" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "likes_post_id" ON "likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "likes_user_id" ON "likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_created_at" ON "posts" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_user_id" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at" ON "users" USING btree ("created_at" desc);