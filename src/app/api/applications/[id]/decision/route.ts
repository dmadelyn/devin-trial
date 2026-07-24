import { NextResponse } from "next/server";
import { withAuthorization } from "@/lib/auth";
import { isAction } from "@/lib/constants";
import { recordDecision, DecisionError } from "@/lib/decisions";
import { serializeApplication, serializeAuditLog } from "@/lib/serialize";

// POST /api/applications/:id/decision
// Server-side access control: only a 'reviewer' may reach the handler; a
// 'viewer' is rejected with 403 by withAuthorization before any work happens.
export const POST = withAuthorization("reviewer", async (req, actor, ctx) => {
  const id = ctx.params.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action, reason } = (body ?? {}) as {
    action?: unknown;
    reason?: unknown;
  };

  if (!isAction(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'." },
      { status: 400 }
    );
  }
  if (reason !== undefined && typeof reason !== "string") {
    return NextResponse.json(
      { error: "reason must be a string." },
      { status: 400 }
    );
  }

  try {
    const { application, audit } = await recordDecision(
      id,
      action,
      actor,
      typeof reason === "string" ? reason : null
    );
    return NextResponse.json({
      application: serializeApplication(application),
      audit: serializeAuditLog(audit),
    });
  } catch (e) {
    if (e instanceof DecisionError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
});
