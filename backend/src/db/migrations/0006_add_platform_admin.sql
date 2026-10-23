-- App owner account: cross-tenant counts and company onboarding, no tenant record access
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" boolean DEFAULT false NOT NULL;
