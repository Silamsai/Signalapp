# 1. What SignalApp is

## The problem

A company selling servers and infrastructure has a sales team that wastes time on cold lists. The best moment to contact a prospect is when something changes: they open a data centre, hire infrastructure engineers, plan a hardware refresh or publish a tender. Those signals are scattered across the web, and finding them, checking them and passing them to the right salesperson is slow and inconsistent.

SignalApp finds those signals, keeps the proof, and walks each account through a disciplined process from "interesting" to "accepted by sales" to "followed up".

## Key words

| Term | Meaning |
|---|---|
| **Tenant** | One customer company using SignalApp. All its data is walled off from every other tenant. |
| **Workspace** | A team area inside a tenant (e.g. "UK team"). Data and memberships are per workspace. |
| **Membership** | "User X has role Y in workspace Z". The only way anyone gets access. |
| **Account** | A prospect company being researched (not a user account). |
| **Evidence** | A cited web source about an account, with its URL and dates. |
| **Signal** | A buying signal extracted from evidence, with score components. |
| **Qualification brief** | Structured facts about the account (use case, timeframe, budget…), each with a *basis*. |
| **Acceptance** | Sales-manager approval of an account's brief. Separate from pipeline stage and tasks. |
| **Handoff** | Passing an accepted account to an external partner firm, sharing only chosen fields. |
| **Suppression** | A "do not contact" domain or email. Honoured everywhere. |

## Walkthrough: a real-world example

Our customer is **Northbridge Systems**, a UK reseller of servers and managed IT. (All companies here are fictional.) Northbridge is one **tenant** in SignalApp with one workspace, "UK Sales".

### 1. Setup: the admin
Priya, Northbridge's **tenant admin**, signs in and goes to **Settings → Offer & targeting**:
- Offering: "Enterprise servers and managed infrastructure"
- Territory: UK, Ireland (stored as ISO codes `GB`, `IE`)
- Industries: Financial Services, Healthcare
- Event window: 90 days (older signals count as *stale*)

Under **Settings → Members** she adds Rahul (Researcher), Sara (SDR), Mark (Sales reviewer) and Alex (Analyst). Each gets a temporary password and must choose their own at first sign-in. Under **Settings → Suppressions** she adds `competitor.co.uk` so it's never contacted.

### 2. Discovery: the researcher
Rahul opens **Discover → Search** and types:
> "UK insurers announcing data centre expansion or server refresh in the last 3 months"

Before anything runs, SignalApp shows how it understood the brief: countries `GB`, industry *Financial Services*, signals *expansion, refresh*, window 90 days. Anything it can't filter on (for example "revenue over £50m") is listed, not silently ignored. Rahul confirms. A **discovery run** goes to a background job that asks **Exa** (a web-search API) for matching companies. It uses research units from Northbridge's monthly quota.

Result: three candidate accounts, including **Harbourline Insurance** (`harbourline.co.uk`). They start as *unresearched*; nothing is assumed yet.

### 3. Research and evidence
Rahul opens Harbourline and clicks **Run research**. The job finds:
- *"Harbourline Insurance opens new Leeds data centre"* (news.example.co.uk, event date 2 Oct)
- *"Harbourline hiring 6 infrastructure engineers"* (jobs site, **event date unknown**)

Each item stores the source URL, publisher, excerpt, event date, discovered date, last-checked date and provider request reference. The unknown date stays unknown (flagged), and a syndicated copy of the same article isn't stored twice. The priority score (e.g. 48/100) is explained as fit + recency + source quality; it's a ranking aid, not a purchase probability.

Rahul reads both sources and clicks **Mark as reviewed** on each.

### 4. Qualification
On **Qualification**, Rahul records facts, each with a basis:

| Field | Value | Basis |
|---|---|---|
| Workload / use case | Private cloud for claims systems | Observed in a source (linked to the Leeds article) |
| Buying timeframe | Q1 next year | Research hypothesis |
| Budget status | (blank) | Unknown, which is valid |

He writes a rationale and clicks **Submit for review**. The account moves **Draft → Ready for review**.

### 5. Sales acceptance: the reviewer
Mark sees Harbourline in **Accounts → Sales acceptance**. To **Accept** he must choose an accountable owner (Sara) and a next action ("Call Head of Infrastructure"). The server also checks that reviewed evidence exists and the domain isn't suppressed. The decision is recorded with Mark's name, time, reason and brief version.

If Mark had chosen **Return**, he'd pick a reason category (e.g. *incomplete evidence*) and the account would go to *Needs research*.

Later, Rahul changes the buying timeframe to "Q3". That's a *material* change, so the accepted brief automatically goes back to **Ready for review**, and history is kept.

### 6. Follow-through: the SDR
Sara sees only accounts she owns or has tasks on. In **Outreach → SDR queue** she has a *Call* task due Friday. She opens **Draft outreach**, which builds an email from reviewed evidence (hypotheses marked separately, no invented contact details). She edits it, approves it and exports the text. She sends it **from her own mailbox**; SignalApp never sends.

After the call she clicks **Complete…** and must enter an outcome ("Spoke to IT lead, meeting being arranged"). Completing a task records activity only. It doesn't change pipeline stage or invent a meeting.

### 7. Partner handoff
Harbourline wants an on-site installer in Leeds. Mark prepares a **handoff** to *Kestrel IT* for their user `jo@kestrel-it.example` (who has a **Partner** membership). He ticks which fields Kestrel may see: name, next action, reviewed evidence. Preparing it shares nothing. Only when Mark clicks **Share** does Jo see it, in her **Shared with me** page, with only those fields. Jo clicks **Acknowledge**; later Mark **Closes** it, which ends her access.

### 8. Reporting: the analyst
Alex opens **Reports → Outcomes** for the last 90 days: research-reviewed accounts, accepted briefs, acceptance rate (with its denominator shown), returned/rejected counts, completed SDR actions by type, handoffs, and research-run quality. CRM opportunities and meetings show "Not connected" because Phase 1 has no CRM.

## What Phase 1 deliberately does NOT do
- Send email, make calls, or sync with a CRM.
- Run scheduled monitors or send notifications.
- Look up or verify personal contact details.

These belong to later phases (see the spec).
