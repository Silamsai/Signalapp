# 3. Architecture and tech stack

## Big picture

```
 Browser ──► Frontend (Next.js, :3000) ──HTTP + session cookie──► API (Fastify, :4000)
                                                                     │
                                       ┌─────────────────────────────┤
                                       ▼                             ▼
                              Postgres on Neon  ◄────────────  Worker (pg-boss jobs)
                              (all data + job queue)               │
                                                                   ▼
                                                           Exa web-research API
```

- The **frontend** is a client-rendered React app. It holds no secrets and calls the API with `credentials: "include"`.
- The **API** authenticates every request, checks workspace membership and capabilities, applies business rules and reads/writes Postgres.
- Slow work (web research, CSV imports) is **queued** and run by the separate **worker** process, so requests return quickly. The UI polls job status.
- **Exa** is called only by the worker, through a provider-neutral adapter. The API key never reaches the browser, exports or logs.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **Next.js 15** (App Router), **React**, **TypeScript**, **Tailwind CSS v4** | File-based routing, fast dev server (Turbopack), typed |
| API | **Fastify 5**, **TypeScript**, **Zod** (request validation) | Fast, simple plugin model; Zod gives typed validation and 400 errors |
| Database | **PostgreSQL on Neon** (serverless), **Drizzle ORM** | Relational data with strict tenant scoping; Drizzle is typed SQL |
| DB driver (API) | `@neondatabase/serverless` over HTTP | No connection pool needed; one HTTPS call per query |
| Migrations | Hand-written SQL in `backend/src/db/migrations`, applied by Drizzle's migrator | Explicit, reviewable schema changes |
| Background jobs | **pg-boss** (job queue stored in Postgres) | Durable retries without another service |
| Web research | **Exa** (`exa-js`) | Web search with highlights, dates and request IDs |
| Auth | Own session cookies (random token, SHA-256 hashed in DB), **bcrypt** passwords | Simple, server-side sessions that can be revoked instantly |
| Tests | **Vitest**; gate tests use `app.inject` against a disposable Neon branch | Real database behaviour without touching production |

## Request lifecycle (API)

1. Fastify receives the request; the route's `preHandler: authenticateRequired` resolves the session cookie to a user (one DB lookup). Users with a temporary password are blocked except on `/v1/auth/*`.
2. The route calls `loadMembership(req, workspaceId)`: the user must have an active (non-revoked) membership in that workspace. **The workspace always comes from membership, never from trusting the client.**
3. `requireCap(m, "…")` checks the capability. For a specific account, `assertAccountReadable(m, id)` also applies tenant/workspace scoping and SDR assignment scoping, and returns 404 for anything outside it.
4. The route parses the body with Zod (bad input → 400) and calls a **service** function with the business rules.
5. Errors are mapped centrally (`middleware/errorHandler.ts`): 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 429 rate/budget limit, 502/503 provider problems. Messages are passed through secret redaction.

## Research job lifecycle

1. `POST /v1/workspaces/:id/research-runs` validates permission, checks the kill switch, **reserves budget** atomically, stores the brief and executed filters plus the playbook version, and queues the job.
2. The worker claims the run, calls Exa (30 s timeout, normalized errors), writes **provider usage immediately**, then stores the fetched results on the run.
3. *Account mode*: evidence is canonicalized, deduplicated per account (URL, content fingerprint, event fingerprint), scored, and contradictions flagged. *Discovery mode*: Exa also returns a structured summary of each article (company name, website, signal type, one-line event). Articles are matched to accounts by website, or by name (flagged for identity review), grouped per company, and saved as evidence on that account, which becomes *researched* and scored. Suppressed domains are skipped, same-name/different-website companies raise merge candidates, and articles about no single company are counted as unmatched. The run's result lists one row per company for the Search table and CSV export.
4. Retries keep the reservation; a retry after charging reuses stored results, so it is **never charged twice**. A final failure refunds only if nothing was charged.

## Performance notes
Each DB query is a network round trip to Neon (~250 ms from far regions). Keep queries few and run independent reads with `Promise.all` (see the account brief route). Hosting the database near users matters more than anything in the code.
