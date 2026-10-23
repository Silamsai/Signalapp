# 6. Rules that must never break

These come from the specification. Each one is covered by a test in `backend/src/test/gates.test.ts`. If you change related code, run the gate tests.

## Access
- **Tenant isolation.** Every query on tenant data filters by `tenant_id`/`workspace_id`. Guessing another tenant's ID returns 403/404, never data. This covers exports, job status and search too.
- **Access comes from membership only**, resolved on the server for every request. Organization affiliation never grants access. The acting user comes from the session, never from a form field.
- **Revocation is immediate**: a revoked member is refused on their next request. Admin password reset signs the person out everywhere.
- **Partners** see only handoffs shared with them, only permitted fields, only reviewed evidence. No workspace-wide reads.
- **Permissions are server-side.** Hiding a button is not security.

## Data integrity
- **Never fabricate** budget, vendor, people, intent, contact details or dates. Unknown is a valid value.
- **Source-observed facts need evidence references; prospect-confirmed facts need a note** of who said what and when. An AI summary alone can't confirm anything.
- **"Not found" is not a negative fact.** A refresh never silently deletes prior evidence.
- **Web pages are untrusted data.** Page text is stored as an excerpt only and never influences system behaviour.
- **Concurrent edits can't silently overwrite**: qualification, acceptance, drafts and tasks use version checks and return 409 on conflict.

## Contact safety
- **Suppression is checked** on import, discovery results, research, contact-task creation, acceptance, handoff sharing and every export.
- **Phase 1 never dispatches** messages or calls. Task completion never changes pipeline stage or creates a meeting.
- **Recording a handoff shares nothing** until a reviewer explicitly shares it.

## Money and providers
- **Research budget is reserved atomically** before a run; exhausted budget refuses new runs (429).
- **Retries never double-charge** or duplicate evidence.
- **The Exa API key never reaches** the browser, an export, an API response or a log. Errors go through `utils/redact.ts`.

## Reporting
- Reports count **recorded events** only and always show cohort, date basis, denominator and currency. Nothing is inferred (e.g. no meetings from task completions).

## The 12 Phase 1 release gates
1. No cross-tenant read/write via guessed ID, export, search or job status.
2. Delegated users see only granted workspaces; revoked users lose access.
3. Live UK results show source references and separate event/discovery/check dates; unknown/contradictory facts stay flagged.
4. Imported duplicates are reviewed; malformed CSV rows give useful errors; exports are formula-safe.
5. Acceptance fails without reviewed evidence, owner and next action; non-reviewers can't approve.
6. Material changes after acceptance require re-review; concurrent saves can't silently overwrite.
7. Task completion requires an outcome and has no side effects.
8. Suppression is honoured in discovery, task creation, exports.
9. Handoffs stay unshared until authorized; partners see only permitted fields.
10. Provider retries can't double-charge or duplicate evidence; exhausted budget stops jobs.
11. Reports reconcile with events and disclose cohort, denominator and currency.
12. No response, export or log contains the provider API key.
