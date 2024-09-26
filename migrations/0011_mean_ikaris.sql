CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_token" ON "refresh_tokens" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_user_id" ON "refresh_tokens" USING btree ("refresh_token","user_id");