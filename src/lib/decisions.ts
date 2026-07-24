import { prisma } from "./prisma";
import { Action, ACTION_TO_STATUS } from "./constants";
import type { Actor } from "./auth";
import { Prisma } from "@prisma/client";

export class DecisionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DecisionError";
  }
}

// ---------------------------------------------------------------------------
// Reusable audit-writing concern.
//
// recordDecision applies a status change AND writes exactly one audit row
// inside a single transaction, so the two can never diverge. The audit table
// is insert-only; this is the only place status transitions happen.
// ---------------------------------------------------------------------------
export async function recordDecision(
  applicationId: string,
  action: Action,
  actor: Actor,
  reason: string | null
) {
  // Reject requires a reason.
  const trimmedReason = reason?.trim() || null;
  if (action === "reject" && !trimmedReason) {
    throw new DecisionError("A reason is required to reject an application.", 400);
  }

  const toStatus = ACTION_TO_STATUS[action];

  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new DecisionError("Application not found.", 404);
    }
    // Only pending applications can be decided; guards against double-decisions.
    if (application.status !== "pending") {
      throw new DecisionError(
        `Application is already '${application.status}' and cannot be changed.`,
        409
      );
    }

    const fromStatus = application.status;

    const updated = await tx.application.update({
      where: { id: applicationId },
      data: { status: toStatus },
    });

    const audit = await tx.auditLog.create({
      data: {
        applicationId,
        actor: actor.name,
        action,
        fromStatus,
        toStatus,
        reason: trimmedReason,
      },
    });

    return { application: updated, audit };
  });
}

export function isPrismaKnownError(
  e: unknown
): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError;
}
