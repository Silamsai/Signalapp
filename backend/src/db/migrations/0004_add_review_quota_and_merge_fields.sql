-- Add fields for research quota periods, acceptance gates, evidence review, imports, draft approval, suppression expiry and merge history
-- Monthly research quota period (resets when the UTC month changes)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "research_quota_period_start" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
-- Tenant-specific acceptance gates configured at onboarding (R5)
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "acceptance_gates_json" text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
-- Where an account came from: manual | import | discovery
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
-- Evidence must be reviewed before acceptance (gate 5)
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "reviewed_by" text;
--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "event_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "country" text;
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN IF NOT EXISTS "mapping_json" text;
--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "approved_by" text;
--> statement-breakpoint
ALTER TABLE "suppressions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "suppressions" ADD COLUMN IF NOT EXISTS "created_by" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_account_url_idx" ON "evidence" ("account_id", "source_id");
--> statement-breakpoint
-- Discovery runs record which candidate accounts they produced; account runs record no-result outcomes
ALTER TABLE "research_runs" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'account' NOT NULL;
--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN IF NOT EXISTS "brief" text;
--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN IF NOT EXISTS "result_json" text;
--> statement-breakpoint
-- Soft merge keeps merge history (R2) and avoids breaking references
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "merged_into_id" text;
