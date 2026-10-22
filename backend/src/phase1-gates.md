# Phase 1 release gates (spec §10)

Track verification after Neon + Exa are configured:

1. Unauthorized user cannot read/mutate another tenant's account via ID, export, search, or job status — enforced via membership middleware.
2. Delegated users see only granted workspaces; revoke removes subsequent access — membership table + session.
3. Live UK results show source references and separate event/discovery/check dates — evidence + sources model.
4. Import duplicates reviewed; malformed CSV errors; formula-safe exports — csv import + `escapeCsvCell`.
5. Acceptance fails without evidence, owner, next action — `services/acceptance.ts`.
6. Material qualification changes after acceptance require re-review — version bump invalidates accepted.
7. Task completion requires outcome; never sends message or changes stage — `services/tasks.ts`.
8. Suppression honored in acceptance/handoff — suppression checks.
9. Handoff remains unshared until share — Prepared vs Shared.
10. Provider retries use idempotency; exhausted budget stops jobs — budget + research run keys.
11. Outcomes disclose cohort/denominator — `services/outcomes.ts`.
12. No API key in browser/export/logs — Exa key server-only; audit strips secrets.
