ALTER TABLE "users" DROP CONSTRAINT "users_profile_image_images_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_profile_image_images_id_fk" FOREIGN KEY ("profile_image") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
