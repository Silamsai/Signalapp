-- Users signing in with an admin-issued temporary password must set their own
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp with time zone;
