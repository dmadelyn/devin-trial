import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyChain, StoredAudit } from "@/lib/hashchain";

// Always recompute against live DB state.
export const dynamic = "force-dynamic";

// GET /api/audit/verify — recompute the audit hash chain and report integrity.
// Returns { valid, count, brokenAt, reason }. Readable by any actor; it only
// reveals whether the trail has been tampered with, not its contents.
export async function GET() {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: "asc" } });
  const chain: StoredAudit[] = rows.map((r) => ({
    seq: r.seq,
    applicationId: r.applicationId,
    actor: r.actor,
    action: r.action,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    reason: r.reason,
    createdAt: r.createdAt,
    prevHash: r.prevHash,
    rowHash: r.rowHash,
  }));

  return NextResponse.json(verifyChain(chain));
}
