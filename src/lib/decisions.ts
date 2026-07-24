import { prisma } from "./prisma";
import { Action, ACTION_TO_STATUS } from "./constants";
import type { Actor } from "./auth";
import { computeRowHash } from "./hashchain";
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
//
// The audit row is hash-chained to its predecessor (see src/lib/hashchain.ts):
// seq/prevHash/rowHash are computed inside the transaction and written as part
// of the single insert (never a follow-up update), keeping the table insert-only.
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

    // Extend the hash chain: read the current tip (serialized by the txn), then
    // compute this row's position and hash before the single insert.
    const tip = await tx.auditLog.findFirst({ orderBy: { seq: "desc" } });
    const seq = tip ? tip.seq + 1 : 1;
    const prevHash = tip ? tip.rowHash : null;
    const createdAt = new Date();
    const rowHash = computeRowHash(prevHash, {
      seq,
      applicationId,
      actor: actor.name,
      action,
      fromStatus,
      toStatus,
      reason: trimmedReason,
      createdAt,
    });

    const audit = await tx.auditLog.create({
      data: {
        seq,
        applicationId,
        actor: actor.name,
        action,
        fromStatus,
        toStatus,
        reason: trimmedReason,
        createdAt,
        prevHash,
        rowHash,
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
