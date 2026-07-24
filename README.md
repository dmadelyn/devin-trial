# KYC Review Queue

An internal tool a fintech compliance analyst uses to approve or reject customer
identity checks that automated verification couldn't clear.

This is a **prototype for a build-vs-buy evaluation**, not production. Two things
are deliberately correct because they carry the point of the exercise:

- **Tamper-evident, append-only audit trail** — every decision is recorded and
  the records are hash-chained so any edit/reorder/delete is *detectable*, not
  just discouraged by convention.
- **Server-side access control** — read-only users are blocked at the API, not
  just in the UI. Identity is resolved from a verified session behind a provider
  seam, so real SSO (Okta) drops in without touching the routes.

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

### Tamper-evident audit trail (hash chain)

Each `AuditLog` row commits to a SHA-256 hash of *(previous row's hash + this
row's canonical content)* — a hash chain (`src/lib/hashchain.ts`). `seq`,
`prevHash`, and `rowHash` are computed **inside** the decision transaction and
written as part of the single insert, so the table stays strictly insert-only
(no follow-up update). Altering, reordering, or deleting any row changes its hash
and breaks every hash after it.

- **`GET /api/audit/verify`** recomputes the chain and reports
  `{ valid, count, brokenAt, reason }`. The **Verify integrity** button on the
  Audit Log surfaces this.
- This *detects* tampering; it doesn't prevent it. Full non-repudiation would add
  signing and/or periodic external anchoring — the seam for that is
  `hashchain.ts`.

### Authentication: session provider seam (SSO-ready, Okta stubbed)

Routes never read identity headers directly — they ask for a verified `Session`
(`src/lib/session.ts`). The provider is selected by `AUTH_MODE`:

- **`AUTH_MODE=dev`** (default) — identity comes from the client role toggle
  (headers), failing closed to `viewer`. Keeps the prototype runnable with no
  IdP. **Not for production.**
- **`AUTH_MODE=okta`** — production SSO. The token-verification boundary is a
  single stubbed function, `verifyOktaSession()`, documenting exactly what to
  implement (verify the Okta JWT against JWKS: `iss`/`aud`/`exp`/signature, map
  group/role claims → `Role`). Until implemented it returns **503** with a clear
  message. Required env: `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`,
  `OKTA_AUDIENCE`.

`withAuthorization` is unchanged by the swap: it returns **401** (no session),
**403** (wrong role), or **503** (SSO selected but not configured).

### Data model (`prisma/schema.prisma`)

- **`Application`** — applicant name, DOB, mock document ID, address, risk flags,
  status, submitted date.
- **`AuditLog`** (insert-only) — application, actor, action, from-status,
  to-status, reason (required on reject), timestamp, plus chain columns `seq`,
  `prevHash`, `rowHash`.

SQLite has no native enums or array columns, so `status`, `action`, and
`riskFlags` are stored as strings/JSON and validated against allowed values in
`src/lib/constants.ts`.

### Audit actor caveat

In the default `dev` auth mode the audit **actor** comes from the client-side
role toggle (sent as request headers). This is called out in the code
(`src/lib/session.ts`, `src/lib/roleContext.tsx`): **in production the actor must
come from a verified session (Okta SSO), never a client-supplied header.** The
Okta provider seam exists precisely to make that swap a one-function change.

## API

| Method | Path                               | Role      | Notes                                  |
| ------ | ---------------------------------- | --------- | -------------------------------------- |
| GET    | `/api/applications?status=`        | any       | Optional `status` filter               |
| POST   | `/api/applications/:id/decision`   | reviewer  | Body `{action, reason?}`; 403 for viewer |
| GET    | `/api/audit`                       | any       | Newest-first audit records             |
| GET    | `/api/audit/verify`                | any       | Recompute hash chain; integrity report |
| GET    | `/api/auth/session`                | any       | Server's view of the current identity  |

### Verify server-side access control

```bash
# Viewer is blocked at the API (403), not just in the UI:
curl -i -X POST http://localhost:3000/api/applications/<id>/decision \
  -H 'x-actor-role: viewer' -H 'content-type: application/json' \
  -d '{"action":"approve"}'
# -> HTTP/1.1 403 Forbidden  {"error":"Forbidden: 'reviewer' role required"}
```

### Verify audit-trail integrity

```bash
curl -s http://localhost:3000/api/audit/verify
# -> {"valid":true,"count":N,"brokenAt":null,"reason":null}
# After any out-of-band edit to an AuditLog row:
# -> {"valid":false,"brokenAt":<seq>,"reason":"rowHash does not match ..."}
```

### Switch to Okta SSO

```bash
AUTH_MODE=okta npm run dev
# Until verifyOktaSession() is implemented, protected calls return:
# -> HTTP/1.1 503  {"error":"Okta SSO is selected ... but not implemented ..."}
```

## Out of scope

SCIM, WORM storage / external hash anchoring, the actual Okta OIDC token exchange
(stubbed at `verifyOktaSession()`), Postgres/hosted DB, document upload, real IDV
integration, notifications, and deployment config are intentionally not built.
