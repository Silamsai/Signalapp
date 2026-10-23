# 7. Setup, testing and migrations

## Prerequisites
- Node.js 20+
- A Neon Postgres database (connection strings for pooled and direct access)
- An Exa API key (research works without it, but runs are refused)

## Environment

`backend/.env` (never commit it):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon connection, used by the API |
| `DATABASE_URL_UNPOOLED` | Direct connection, used by migrations and the job queue |
| `AUTH_SECRET` | 16+ random characters, used when hashing session tokens |
| `EXA_API_KEY` | Exa web-research key |
| `FRONTEND_ORIGIN` | e.g. `http://localhost:3000` (CORS) |
| `PORT` | API port, default 4000 |
| `NODE_ENV` | `production` enables secure cookies |

`frontend/.env`: `NEXT_PUBLIC_API_URL=http://localhost:4000`

## First run

```bash
cd backend
npm install
npm run db:migrate
SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='a long password' npm run db:seed
npm run dev          # API
npm run worker       # second terminal: research + import jobs

cd ../frontend
npm install
npm run dev          # http://localhost:3000
```

Sign in with the seeded admin, then add other people under **Settings → Members**. No login details are stored in the code.

## Migrations
- Files live in `backend/src/db/migrations/`, numbered and **named by purpose** (e.g. `0005_add_password_change_flag.sql`), each listed in `meta/_journal.json`.
- They're hand-written SQL. Use `IF EXISTS` / `IF NOT EXISTS` so they're safe to re-run. Separate statements with `--> statement-breakpoint`.
- **Never edit or rename a migration that has been applied** to a shared database. Add a new one.
- After pulling changes, always run `npm run db:migrate` before starting the app. If login suddenly returns "Internal server error", a migration is usually missing.

## Tests

```bash
cd backend
npm test                                                   # unit tests (no DB needed)
TEST_DATABASE_URL=<disposable db> npm run test:gates       # the 12 release gates, end to end
```

- Gate tests migrate the target database and create their own tenants and users. They **refuse to run** against the `DATABASE_URL` in `.env`. Use a throwaway Neon branch (`neon branches create --name gate-tests`).
- The Exa provider is replaced by a fake in tests, and the job queue is mocked so handlers run directly.
- Frontend checks: `cd frontend && npm run lint && npm run build`.

## Useful commands

| Command | What it does |
|---|---|
| `npm run build` (backend) | Compile TypeScript to `dist/` |
| `npx tsc --noEmit` | Type-check without building |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run build && npm start` (frontend) | Production build: much faster than dev mode |
