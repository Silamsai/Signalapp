CREATE TABLE IF NOT EXISTS "tenants" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "research_quota_monthly" integer DEFAULT 100 NOT NULL,
  "research_used_monthly" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "workspaces_tenant_idx" ON "workspaces" ("tenant_id");

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uidx" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_ws_uidx" ON "memberships" ("user_id","workspace_id");
CREATE INDEX IF NOT EXISTS "memberships_workspace_idx" ON "memberships" ("workspace_id");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_uidx" ON "sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "name" text NOT NULL,
  "domain" text,
  "country" text,
  "legal_name" text,
  "research_state" text DEFAULT 'unresearched' NOT NULL,
  "fit_score" integer,
  "acceptance_state" text DEFAULT 'draft' NOT NULL,
  "owner_user_id" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "accounts_workspace_idx" ON "accounts" ("workspace_id");
CREATE INDEX IF NOT EXISTS "accounts_tenant_idx" ON "accounts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "accounts_domain_idx" ON "accounts" ("workspace_id","domain");

CREATE TABLE IF NOT EXISTS "account_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_identities_account_idx" ON "account_identities" ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "account_identities_ws_kind_val_uidx" ON "account_identities" ("workspace_id","kind","value");

CREATE TABLE IF NOT EXISTS "merge_candidates" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id_a" text NOT NULL REFERENCES "accounts"("id"),
  "account_id_b" text NOT NULL REFERENCES "accounts"("id"),
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "merge_candidates_workspace_idx" ON "merge_candidates" ("workspace_id");

CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "status" text DEFAULT 'queued' NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "success_rows" integer DEFAULT 0 NOT NULL,
  "error_rows" integer DEFAULT 0 NOT NULL,
  "row_errors_json" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "import_jobs_workspace_idx" ON "import_jobs" ("workspace_id");

CREATE TABLE IF NOT EXISTS "offers" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "offering" text DEFAULT '' NOT NULL,
  "buyer_roles_json" text DEFAULT '[]' NOT NULL,
  "industries_json" text DEFAULT '[]' NOT NULL,
  "company_sizes_json" text DEFAULT '[]' NOT NULL,
  "territory_json" text DEFAULT '[]' NOT NULL,
  "exclusions_json" text DEFAULT '[]' NOT NULL,
  "event_window_days" integer DEFAULT 90 NOT NULL,
  "natural_language_brief" text,
  "structured_query_json" text,
  "unsupported_filters_json" text DEFAULT '[]' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "offers_workspace_idx" ON "offers" ("workspace_id");

CREATE TABLE IF NOT EXISTS "playbook_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "name" text NOT NULL,
  "template_key" text NOT NULL,
  "version" integer NOT NULL,
  "rules_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "playbook_versions_workspace_idx" ON "playbook_versions" ("workspace_id");

CREATE TABLE IF NOT EXISTS "research_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text REFERENCES "accounts"("id"),
  "status" text DEFAULT 'queued' NOT NULL,
  "query" text NOT NULL,
  "filters_json" text DEFAULT '{}' NOT NULL,
  "playbook_version_id" text,
  "budget_reserved" integer DEFAULT 1 NOT NULL,
  "budget_actual" integer,
  "provider_run_id" text,
  "idempotency_key" text,
  "error_code" text,
  "error_message" text,
  "progress_pct" integer DEFAULT 0 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "research_runs_workspace_idx" ON "research_runs" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "research_runs_idempotency_uidx" ON "research_runs" ("workspace_id","idempotency_key");

CREATE TABLE IF NOT EXISTS "provider_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "research_run_id" text REFERENCES "research_runs"("id"),
  "provider" text NOT NULL,
  "request_ref" text,
  "units" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "provider_usage_tenant_idx" ON "provider_usage" ("tenant_id");

CREATE TABLE IF NOT EXISTS "sources" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "canonical_url" text NOT NULL,
  "publisher" text,
  "title" text,
  "content_fingerprint" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "sources_ws_url_uidx" ON "sources" ("workspace_id","canonical_url");

CREATE TABLE IF NOT EXISTS "evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "source_id" text NOT NULL REFERENCES "sources"("id"),
  "research_run_id" text REFERENCES "research_runs"("id"),
  "excerpt" text,
  "event_date" timestamp with time zone,
  "discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "match_rationale" text,
  "extraction_version" text DEFAULT '1' NOT NULL,
  "provider_request_ref" text,
  "stale" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "evidence_account_idx" ON "evidence" ("account_id");
CREATE INDEX IF NOT EXISTS "evidence_workspace_idx" ON "evidence" ("workspace_id");

CREATE TABLE IF NOT EXISTS "signals" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "evidence_id" text REFERENCES "evidence"("id"),
  "kind" text NOT NULL,
  "observed_fact" text,
  "hypothesis" text,
  "unknown_note" text,
  "fit_component" integer,
  "recency_component" integer,
  "quality_component" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "signals_account_idx" ON "signals" ("account_id");

CREATE TABLE IF NOT EXISTS "qualifications" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "version" integer DEFAULT 1 NOT NULL,
  "rationale" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "qualifications_account_idx" ON "qualifications" ("account_id");

CREATE TABLE IF NOT EXISTS "qualification_facts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "qualification_id" text NOT NULL REFERENCES "qualifications"("id"),
  "field_key" text NOT NULL,
  "value" text,
  "basis" text DEFAULT 'unknown' NOT NULL,
  "evidence_ids_json" text DEFAULT '[]' NOT NULL,
  "confirmation_note" text,
  "confirmer_user_id" text,
  "confirmed_at" timestamp with time zone,
  "superseded_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "qualification_facts_qual_idx" ON "qualification_facts" ("qualification_id");

CREATE TABLE IF NOT EXISTS "acceptance_decisions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "from_state" text NOT NULL,
  "to_state" text NOT NULL,
  "reason_category" text,
  "reason_detail" text,
  "brief_version" text,
  "next_action" text,
  "owner_user_id" text,
  "actor_user_id" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "acceptance_decisions_account_idx" ON "acceptance_decisions" ("account_id");

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "type" text NOT NULL,
  "owner_user_id" text NOT NULL REFERENCES "users"("id"),
  "due_at" timestamp with time zone,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "instruction" text,
  "status" text DEFAULT 'open' NOT NULL,
  "outcome" text,
  "cancel_reason" text,
  "priority" text DEFAULT 'normal' NOT NULL,
  "idempotency_key" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tasks_workspace_idx" ON "tasks" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_idempotency_uidx" ON "tasks" ("workspace_id","idempotency_key");

CREATE TABLE IF NOT EXISTS "activities" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text REFERENCES "accounts"("id"),
  "task_id" text REFERENCES "tasks"("id"),
  "kind" text NOT NULL,
  "note" text,
  "actor_user_id" text NOT NULL,
  "external_event_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "activities_workspace_idx" ON "activities" ("workspace_id");

CREATE TABLE IF NOT EXISTS "handoffs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "receiving_org" text NOT NULL,
  "receiving_user" text,
  "internal_owner_user_id" text NOT NULL,
  "permitted_fields_json" text DEFAULT '[]' NOT NULL,
  "reason" text NOT NULL,
  "next_action" text,
  "due_at" timestamp with time zone,
  "state" text DEFAULT 'prepared' NOT NULL,
  "return_reason" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "shared_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "handoffs_account_idx" ON "handoffs" ("account_id");

CREATE TABLE IF NOT EXISTS "handoff_access" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "handoff_id" text NOT NULL REFERENCES "handoffs"("id"),
  "grantee_email" text NOT NULL,
  "fields_json" text DEFAULT '[]' NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "handoff_access_handoff_idx" ON "handoff_access" ("handoff_id");

CREATE TABLE IF NOT EXISTS "drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "channel" text DEFAULT 'email' NOT NULL,
  "subject" text,
  "body" text DEFAULT '' NOT NULL,
  "evidence_ids_json" text DEFAULT '[]' NOT NULL,
  "hypotheses_json" text DEFAULT '[]' NOT NULL,
  "stale_warning" integer DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "author_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "drafts_account_idx" ON "drafts" ("account_id");

CREATE TABLE IF NOT EXISTS "suppressions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id"),
  "scope" text DEFAULT 'workspace' NOT NULL,
  "address_or_domain" text NOT NULL,
  "reason" text NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "effective_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "suppressions_workspace_idx" ON "suppressions" ("workspace_id");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "workspace_id" text REFERENCES "workspaces"("id"),
  "actor_user_id" text,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_events_tenant_idx" ON "audit_events" ("tenant_id");
