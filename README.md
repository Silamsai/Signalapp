# SignalApp

SignalApp helps infrastructure sales teams find accounts that are ready to engage, build a clear brief with evidence, and follow through — then monitor changes, run approved outreach sequences, and improve ranking over time.

## What it does

- **Discover** — Spot opportunities and search for prospects that match your offer.
- **Accounts** — Watchlist, sales acceptance, pipeline, and **Monitors** for scheduled change alerts.
- **Qualify & hand off** — Shared briefs, acceptance, and partner handoffs (prepare → share → acknowledge / return → close).
- **Outreach** — SDR tasks, drafts, **Campaigns** (approve then launch), and **Replies**.
- **Reports** — Outcomes plus **Score models** to evaluate and activate ranking rules.
- **Settings** — Offer targeting, connections & usage (kill switches), and **Sending accounts**.

CRM sync is not part of this deployment.

## How to use it

1. **Log in** with your workspace credentials.
2. Configure **Settings → Offer & targeting**.
3. Use **Discover** / imports, then open an account to research and qualify.
4. Submit for **sales acceptance**; use **Handoff** when a partner should take over.
5. Create **Monitors** under Accounts to watch for material changes (alerts appear in the header).
6. Under **Settings → Sending accounts**, add a domain, verify, connect a mailbox, and enable it (simulated sending).
7. Build a **Campaign**, save a draft, submit → approve → launch. Check **Replies** for inbound responses (or simulate one).
8. In **Reports → Score models**, create a candidate, evaluate, activate, or roll back.

## Getting started (local)

1. Start the API and worker from `backend/`.
2. Start the web app from `frontend/`.
3. Open the login page.

Demo login after seed:

- Email: `admin@signal.local`
- Password: `password123`

## Notes

- Campaign email uses a **simulated** sender — nothing is delivered to a real inbox.
- Create account / forgot password on the login screen still require a workspace admin for real access.
- Sending and research can be paused with kill switches under Connections & usage.
