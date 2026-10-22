CREATE TABLE IF NOT EXISTS "monitors" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text REFERENCES "accounts"("id"),
  "name" text NOT NULL,
  "query" text NOT NULL,
  "cadence_hours" integer DEFAULT 24 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "last_success_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_run_status" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "monitors_workspace_idx" ON "monitors" ("workspace_id");

CREATE TABLE IF NOT EXISTS "monitor_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "monitor_id" text NOT NULL REFERENCES "monitors"("id"),
  "status" text NOT NULL,
  "result_summary" text,
  "error" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "monitor_runs_monitor_idx" ON "monitor_runs" ("monitor_id");

CREATE TABLE IF NOT EXISTS "change_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "monitor_id" text NOT NULL REFERENCES "monitors"("id"),
  "dedupe_key" text NOT NULL,
  "title" text NOT NULL,
  "detail" text,
  "material" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "change_events_monitor_idx" ON "change_events" ("monitor_id");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "entity_type" text,
  "entity_id" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id", "workspace_id");

CREATE TABLE IF NOT EXISTS "entitlements" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "research_enabled" boolean DEFAULT true NOT NULL,
  "sending_enabled" boolean DEFAULT true NOT NULL,
  "monitors_enabled" boolean DEFAULT true NOT NULL,
  "research_kill_switch" boolean DEFAULT false NOT NULL,
  "sending_kill_switch" boolean DEFAULT false NOT NULL,
  "send_quota_monthly" integer DEFAULT 500 NOT NULL,
  "send_used_monthly" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "entitlements_workspace_idx" ON "entitlements" ("workspace_id");

CREATE TABLE IF NOT EXISTS "sending_domains" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "domain" text NOT NULL,
  "dns_status" text DEFAULT 'pending' NOT NULL,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sending_domains_workspace_idx" ON "sending_domains" ("workspace_id");

CREATE TABLE IF NOT EXISTS "sending_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "domain_id" text NOT NULL REFERENCES "sending_domains"("id"),
  "mailbox" text NOT NULL,
  "display_name" text,
  "provider" text DEFAULT 'simulated' NOT NULL,
  "connection_state" text DEFAULT 'disconnected' NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "daily_limit" integer DEFAULT 50 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sending_accounts_workspace_idx" ON "sending_accounts" ("workspace_id");

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "name" text NOT NULL,
  "objective" text,
  "owner_user_id" text NOT NULL REFERENCES "users"("id"),
  "sending_account_id" text REFERENCES "sending_accounts"("id"),
  "state" text DEFAULT 'draft' NOT NULL,
  "active_version_id" text,
  "require_accepted" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "campaigns_workspace_idx" ON "campaigns" ("workspace_id");

CREATE TABLE IF NOT EXISTS "campaign_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "campaign_id" text NOT NULL REFERENCES "campaigns"("id"),
  "version" integer NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL,
  "audience_json" text DEFAULT '[]' NOT NULL,
  "schedule_json" text DEFAULT '{}' NOT NULL,
  "sending_account_id" text,
  "approved_at" timestamp with time zone,
  "approved_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_versions_uidx" ON "campaign_versions" ("campaign_id", "version");

CREATE TABLE IF NOT EXISTS "sequence_steps" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "campaign_version_id" text NOT NULL REFERENCES "campaign_versions"("id"),
  "step_index" integer NOT NULL,
  "delay_hours" integer DEFAULT 0 NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "sequence_steps_version_idx" ON "sequence_steps" ("campaign_version_id");

CREATE TABLE IF NOT EXISTS "enrollments" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "campaign_id" text NOT NULL REFERENCES "campaigns"("id"),
  "campaign_version_id" text NOT NULL REFERENCES "campaign_versions"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "email" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "stop_reason" text,
  "next_step_index" integer DEFAULT 0 NOT NULL,
  "next_send_at" timestamp with time zone,
  "last_submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_version_email_uidx" ON "enrollments" ("campaign_version_id", "email");
CREATE INDEX IF NOT EXISTS "enrollments_next_send_idx" ON "enrollments" ("next_send_at");

CREATE TABLE IF NOT EXISTS "outbound_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "enrollment_id" text NOT NULL REFERENCES "enrollments"("id"),
  "step_id" text NOT NULL REFERENCES "sequence_steps"("id"),
  "campaign_version_id" text NOT NULL,
  "provider_message_id" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL,
  "error" text,
  "submitted_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "outbound_enroll_step_uidx" ON "outbound_messages" ("enrollment_id", "step_id", "campaign_version_id");

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "enrollment_id" text REFERENCES "enrollments"("id"),
  "account_id" text REFERENCES "accounts"("id"),
  "contact_email" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "assigned_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "conversations_workspace_idx" ON "conversations" ("workspace_id");

CREATE TABLE IF NOT EXISTS "reply_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "conversation_id" text NOT NULL REFERENCES "conversations"("id"),
  "provider_thread_id" text,
  "classification" text DEFAULT 'reply' NOT NULL,
  "body_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "reply_events_conversation_idx" ON "reply_events" ("conversation_id");

CREATE TABLE IF NOT EXISTS "suppression_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "address" text NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "suppression_events_workspace_idx" ON "suppression_events" ("workspace_id", "address");

CREATE TABLE IF NOT EXISTS "delivery_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "outbound_message_id" text NOT NULL REFERENCES "outbound_messages"("id"),
  "kind" text NOT NULL,
  "detail" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "delivery_events_message_idx" ON "delivery_events" ("outbound_message_id");

CREATE TABLE IF NOT EXISTS "score_model_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "name" text NOT NULL,
  "version" integer NOT NULL,
  "status" text DEFAULT 'candidate' NOT NULL,
  "rules_json" text NOT NULL,
  "notes" text,
  "created_by" text NOT NULL,
  "activated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "score_models_workspace_idx" ON "score_model_versions" ("workspace_id");

CREATE TABLE IF NOT EXISTS "score_eval_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "model_version_id" text NOT NULL REFERENCES "score_model_versions"("id"),
  "held_out_size" integer DEFAULT 0 NOT NULL,
  "precision_pct" integer,
  "recall_pct" integer,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "score_evals_model_idx" ON "score_eval_runs" ("model_version_id");
