// Demo utility: edits an audit row out of band, going around the app, to show that
// GET /api/audit/verify detects it. This is the "DBA with write access" scenario --
// the app itself has no code path that updates or deletes an AuditLog row.
//
//   node scripts/tamper-audit.mjs          tamper with the first row
//   node scripts/tamper-audit.mjs 3        tamper with seq 3
//
// Run `npm run db:seed` afterwards to restore a clean chain.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requestedSeq = process.argv[2] ? Number(process.argv[2]) : null;

if (requestedSeq !== null && !Number.isInteger(requestedSeq)) {
  console.error(`Not a valid seq: ${process.argv[2]}`);
  process.exit(1);
}

const row = requestedSeq === null
  ? await prisma.auditLog.findFirst({ orderBy: { seq: "asc" } })
  : await prisma.auditLog.findUnique({ where: { seq: requestedSeq } });

if (!row) {
  console.error(
    requestedSeq === null
      ? "No audit rows to tamper with. Approve or reject a case first."
      : `No audit row with seq ${requestedSeq}.`
  );
  process.exit(1);
}

// Raw SQL on purpose: the Prisma model is only ever used to insert, so this has to
// bypass the application's own write path to be a fair demonstration.
await prisma.$executeRaw`
  UPDATE AuditLog SET reason = 'EDITED OUT OF BAND' WHERE seq = ${row.seq}
`;

console.log(`Tampered with seq ${row.seq} (reason -> 'EDITED OUT OF BAND').`);
console.log("Now reload the Audit Log and click Verify integrity.");

await prisma.$disconnect();
