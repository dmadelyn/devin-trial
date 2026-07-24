import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStatus } from "@/lib/constants";
import { serializeApplication } from "@/lib/serialize";

// GET /api/applications?status=pending|approved|rejected
// Reading the queue is allowed for any role.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");

  if (statusParam && !isStatus(statusParam)) {
    return NextResponse.json(
      { error: `Invalid status filter: ${statusParam}` },
      { status: 400 }
    );
  }

  const applications = await prisma.application.findMany({
    where: statusParam ? { status: statusParam } : undefined,
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({
    applications: applications.map(serializeApplication),
  });
}
