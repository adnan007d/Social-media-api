ALTER TABLE "users" DROP CONSTRAINT "users_profile_image_images_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "profile_image";