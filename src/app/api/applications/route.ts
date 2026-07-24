import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStatus } from "@/lib/constants";
import { serializeApplication } from "@/lib/serialize";
import {
  parseNewApplication,
  createApplication,
  ValidationError,
} from "@/lib/applications";

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

// POST /api/applications — ingest a new (pending) application into the queue.
// Represents the upstream IDV vendor feeding cases it couldn't auto-clear.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const input = parseNewApplication(body);
    const application = await createApplication(input);
    return NextResponse.json(
      { application: serializeApplication(application) },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
