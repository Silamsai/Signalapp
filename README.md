# SignalApp

SignalApp helps infrastructure sales teams find accounts showing buying signals, build an evidence-backed qualification brief, get it accepted by sales, and follow through with SDR tasks and partner handoffs. This is **Phase 1** of the Infrastructure Signal specification. SignalApp never sends emails or makes calls.

## Roles

| Role | What they see |
|---|---|
| Tenant admin | Everything, plus members, settings, suppression list and research kill switch |
| Researcher | Discover, accounts, research, evidence review, qualification, drafts |
| SDR | Their own accounts and task queue, drafts, outcomes |
| Sales reviewer | Sales acceptance, owners, partner handoffs, reports |
| Partner | Only handoffs shared with them, only the permitted fields |
| Analyst | Reports only |

## Run locally

```bash
cd backend
npm install
npm run db:migrate     # applies migrations (0003 drops unused feature tables, 0004 adds review/quota/merge fields)
SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='at least 12 characters' npm run db:seed
npm run dev            # API on :4000
npm run worker         # research + import jobs (separate terminal)

cd ../frontend
npm install
npm run dev            # web on :3000
```

The seed creates your company (tenant), its first workspace and its first admin from the values you pass. No login details are stored in the code. Sign in as that admin and add everyone else under **Settings → Members**.

Required backend env: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET` (16+ chars), `EXA_API_KEY`, `FRONTEND_ORIGIN`. Set `NODE_ENV=production` in production for secure cookies.

## Tests

```bash
cd backend
npm test                                              # unit tests
TEST_DATABASE_URL=<disposable db url> npm run test:gates   # the 12 Phase 1 release gates
```

The gate tests refuse to run against the `DATABASE_URL` in `.env`. Use a throwaway Neon branch.

## Not in Phase 1

CRM sync, monitors, email campaigns/sending and score-model optimization (spec Phases 2–4).
