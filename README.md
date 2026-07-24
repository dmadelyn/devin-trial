# KYC Review Queue

An internal tool a fintech compliance analyst uses to approve or reject customer
identity checks that automated verification couldn't clear.

This is a **prototype for a build-vs-buy evaluation**, not production. Two things
are deliberately correct because they carry the point of the exercise:

- **Append-only audit trail** — every decision is recorded and history is never
  rewritten.
- **Server-side access control** — read-only users are blocked at the API, not
  just in the UI.

## Stack

- **Next.js** (App Router, TypeScript) — UI + API in one app
- **Prisma** + **SQLite** (local `dev.db`)
- Plain CSS, no component library

## Run

```bash
npm install
npx prisma migrate dev --name init   # creates dev.db and applies the migration
npm run db:seed                       # ~18 applications, 5 pending
npm run dev                           # http://localhost:3000
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`.

## What's here

- **Queue** (`/`) — table of applications (applicant, submitted date, risk flags,
  status) with a status filter. Click a row to expand its full detail inline.
- **Decision** — Reviewers can Approve or Reject a *pending* application. Reject
  requires a reason. Each decision updates the status **and** writes exactly one
  audit record inside a single transaction.
- **Audit Log** (`/audit`) — every decision, newest first (actor, action,
  from→to, reason, time).
- **Role toggle** (header) — switch between **Reviewer** and **Viewer**. A Viewer
  sees no actions, and the decision API returns **403** for a Viewer even via a
  direct `curl`.

## Design notes

### Role checking and audit writing as reusable concerns

Both are factored into `src/lib/` so screens/routes don't re-implement them:

- **`src/lib/auth.ts`** — `withAuthorization(role, handler)` wraps any API route
  behind a required role and short-circuits with 403 otherwise; `getActor(req)`
  reads the acting identity. The decision route is simply
  `export const POST = withAuthorization("reviewer", handler)`.
- **`src/lib/decisions.ts`** — `recordDecision()` is the single place a status
  transition happens. It performs the status update and the audit insert inside
  one `prisma.$transaction`, so the two can never diverge.

### Data model (`prisma/schema.prisma`)

- **`Application`** — applicant name, DOB, mock document ID, address, risk flags,
  status, submitted date.
- **`AuditLog`** (insert-only) — application, actor, action, from-status,
  to-status, reason (required on reject), timestamp.

SQLite has no native enums or array columns, so `status`, `action`, and
`riskFlags` are stored as strings/JSON and validated against allowed values in
`src/lib/constants.ts`.

### Audit actor caveat

Per the scope, the audit **actor** comes from the client-side role toggle (sent
as request headers). This is called out in the code (`src/lib/auth.ts`,
`src/lib/roleContext.tsx`): **in production the actor must come from a verified
session (signed cookie / SSO), never a client-supplied header.**

## API

| Method | Path                               | Role      | Notes                                  |
| ------ | ---------------------------------- | --------- | -------------------------------------- |
| GET    | `/api/applications?status=`        | any       | Optional `status` filter               |
| POST   | `/api/applications/:id/decision`   | reviewer  | Body `{action, reason?}`; 403 for viewer |
| GET    | `/api/audit`                       | any       | Newest-first audit records             |

### Verify server-side access control

```bash
# Viewer is blocked at the API (403), not just in the UI:
curl -i -X POST http://localhost:3000/api/applications/<id>/decision \
  -H 'x-actor-role: viewer' -H 'content-type: application/json' \
  -d '{"action":"approve"}'
# -> HTTP/1.1 403 Forbidden  {"error":"Forbidden: 'reviewer' role required"}
```

## Out of scope

Real SSO/OAuth, SCIM, cryptographic/tamper-evident audit (hash-chaining, WORM),
Postgres/hosted DB, document upload, real IDV integration, notifications, and
deployment config are intentionally not built.
