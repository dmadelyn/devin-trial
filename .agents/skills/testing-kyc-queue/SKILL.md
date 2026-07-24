---
name: Testing the KYC Review Queue (Next.js + Prisma/SQLite)
description: How to set up, seed, and adversarially test the KYC review queue app, including forcing a browser timezone to test date-formatting fixes.
---

# KYC Review Queue — testing notes

## Run / setup
- Repo: `/home/ubuntu/repos/devin-trial`. Stack: Next.js 14 App Router + Prisma + SQLite.
- Setup: `npm install` → `npx prisma migrate dev --name init` → `npm run db:seed` → `npm run dev` (http://localhost:3000).
- `npm run db:seed` resets to a deterministic state: **18 apps, 5 pending, 0 audit rows**. Run it before every test for predictable counts (All=18, Pending=5, Approved=8, Rejected=5).
- If a long-running dev server throws a 500 like `Cannot find module './NNN.js'` on an API route, it's a **stale `.next` build** — `rm -rf .next` and restart `npm run dev`.

## Roles / RBAC
- Header toggle switches Reviewer ("Riley Reviewer") ↔ Viewer ("Vic Viewer"); role persists in `localStorage` (`kyc-role`), so it may start as Viewer from a prior session — set it explicitly.
- Role is sent via `x-actor-role` / `x-actor-name` headers. Server enforces `reviewer` for `POST /api/applications/:id/decision` (403 otherwise). Verify RBAC with curl (no browser cookies needed):
  - viewer → `curl -i -X POST .../decision -H 'x-actor-role: viewer' -d '{"action":"approve"}'` → **403** `{"error":"Forbidden: 'reviewer' role required"}`.
  - reviewer (same id) → **200**. Always run BOTH to prove it's role-based, not a blanket block.
- Reject requires a reason: empty reason → **400** `{"error":"A reason is required to reject an application."}` and writes NO audit row. Get a pending id from `curl -s '.../api/applications?status=pending'`.

## Testing date-formatting fixes (timezone) — IMPORTANT
- The box is **UTC**, so date-only fixes that use `timeZone:"UTC"` render identically to the buggy code in a UTC browser — a UTC test is NOT adversarial. Force the browser into a UTC-negative zone.
- Chrome runs with `--remote-debugging-port=29229`. Override the page timezone via CDP `Emulation.setTimezoneOverride`. The override only lives while the setting connection stays open, so hold it with a background Node script (Node 20 needs `--experimental-websocket`):
  ```js
  // /tmp/tzoverride.mjs  — run: node --experimental-websocket /tmp/tzoverride.mjs America/Los_Angeles
  const t=(await (await fetch('http://localhost:29229/json')).json()).find(x=>x.type==='page');
  const ws=new WebSocket(t.webSocketDebuggerUrl); let id=0;
  ws.addEventListener('open',()=>ws.send(JSON.stringify({id:++id,method:'Emulation.setTimezoneOverride',params:{timezoneId:process.argv[2]}})));
  setInterval(()=>{},1<<30);
  ```
  Run it in the background BEFORE opening the app; verify via `browser_console`: `Intl.DateTimeFormat().resolvedOptions().timeZone`. Kill the process to restore UTC.
- Queue data is fetched client-side (`useEffect`), so only the browser TZ matters (no SSR involvement for these dates). In America/Los_Angeles, seed DOB `1990-04-12` renders **Apr 11** with the old code and **Apr 12** with the fix.
- Audit-log timestamps use `formatDateTime` (local time, intentionally NOT UTC) — a decision made "now" shows LA local time, distinct from the date-only UTC formatting.

## Filter persistence / stale-response race (fixed — regression check)
- The status filter persists in `localStorage` (`kyc-queue-filter`). On mount an initial `all` fetch and the restored filter's fetch race; `load()` guards against this with a request-id ref so only the latest response applies.
- Regression check: set the filter to Pending, navigate to Audit Log and back (and hard-reload) — the dropdown must read "Pending" AND show 5 rows ("5 shown"), not 18. Historically the `all` response could resolve last and overwrite the filtered list (dropdown "Pending" but 18 rows). Confirm request ordering via `performance.getEntriesByType('resource')` if it ever regresses.

## Devin Secrets Needed
- None. Everything runs locally with no external credentials.
