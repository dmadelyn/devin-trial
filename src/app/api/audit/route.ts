import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeAuditLog } from "@/lib/serialize";

// Always read live from the DB; never statically prerender this route.
export const dynamic = "force-dynamic";

// GET /api/audit — all audit records, newest first.
export async function GET() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { application: { select: { applicantName: true } } },
  });

  return NextResponse.json({ logs: logs.map(serializeAuditLog) });
}
