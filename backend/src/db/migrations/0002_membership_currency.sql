ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'GBP' NOT NULL;
