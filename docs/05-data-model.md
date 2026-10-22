# 5. Data model

Every tenant-owned table has `tenant_id` and (almost always) `workspace_id`. IDs are opaque strings with a prefix (`acc_…`, `ev_…`). Timestamps are UTC (`timestamptz`). Mutable records that people edit concurrently have a `version` used for optimistic locking.

## Tables by area (`backend/src/db/schema/`)

| Area | Tables | Notes |
|---|---|---|
| Identity (`identity.ts`) | `tenants`, `workspaces`, `users`, `memberships`, `sessions` | Membership = user + workspace + role (+ `revoked_at`). Tenant holds the monthly research quota. Users have `must_change_password`. |
| Accounts (`accounts.ts`) | `accounts`, `account_identities`, `merge_candidates`, `import_jobs` | Account has `research_state`, `acceptance_state`, `owner_user_id`, `source`, `version`, `merged_into_id` (soft merge keeps history). |
| Config (`config.ts`) | `offers`, `playbook_versions` | Targeting per workspace; playbooks are versioned templates. |
| Research (`research.ts`) | `research_runs`, `provider_usage`, `sources`, `evidence`, `signals` | Run stores mode, brief, executed filters, playbook version, budget, result. Evidence stores URL source, excerpt, event/discovered/checked dates, provider ref, review stamp. |
| Qualification (`qualification.ts`) | `qualifications`, `qualification_facts` | Facts are append-only; an edit inserts a new fact and sets `superseded_by` on the old one. |
| Workflow (`workflow.ts`) | `acceptance_decisions`, `tasks`, `activities`, `handoffs`, `handoff_access` | Decisions are an immutable history. Activities record task completions/cancellations. Handoff access rows are the partner grants. |
| Drafts (`drafts.ts`) | `drafts` | Cited evidence IDs, hypotheses, version, approval stamp. |
| Suppression & audit | `suppressions`, `audit_events` | Suppressions expire instead of being deleted. Audit metadata is redacted of secrets. |
| Ops (`ops.ts`) | `entitlements` | Research enabled flag and kill switch per workspace. |

## Relationships

```
tenant ─< workspace ─< membership >─ user
              │
              ├─< account ─< evidence >─ source
              │      │  └─< signal
              │      ├── qualification ─< qualification_fact
              │      ├─< acceptance_decision
              │      ├─< task ─< activity
              │      ├─< draft
              │      └─< handoff ─< handoff_access (partner grants)
              ├─< research_run ─< provider_usage
              ├── offer, playbook_version, entitlements
              └─< suppression, merge_candidate, import_job, audit_event
```

## Rules baked into the data
- **Observed facts, hypotheses and unknowns are separate**: `signals.observed_fact` vs `hypothesis` vs `unknown_note`; fact `basis` is one of `unknown`, `research_hypothesis`, `source_observed`, `prospect_confirmed`.
- **Unknown dates stay null.** Nothing back-fills an event date.
- **History is preserved**: superseded facts, decision rows, merged accounts (`merged_into_id`), expired suppressions.
- **Acceptance state is separate** from tasks and from any pipeline stage.
