-- Drop tables for features removed from this deployment (monitors, notifications, campaigns/sending, score models)
DROP TABLE IF EXISTS "delivery_events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "reply_events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "conversations" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "outbound_messages" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "enrollments" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "sequence_steps" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "campaign_versions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "campaigns" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "sending_accounts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "sending_domains" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "suppression_events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "score_eval_runs" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "score_model_versions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "notifications" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "change_events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "monitor_runs" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "monitors" CASCADE;
--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "sending_enabled";
--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "monitors_enabled";
--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "sending_kill_switch";
--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "send_quota_monthly";
--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN IF EXISTS "send_used_monthly";
