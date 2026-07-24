import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Tamper-evident audit trail (hash chain).
//
// Every audit row commits to a SHA-256 hash of (previous row's hash + this
// row's canonical content). The rows therefore form a chain: altering,
// reordering, or deleting any row changes its hash and breaks every hash after
// it, so tampering is *detectable* — the trail is append-only by cryptography,
// not just by convention.
//
// This detects tampering; it does not prevent it. Full non-repudiation would
// add signing and/or periodic external anchoring — out of scope for the
// prototype, but this is the seam where that would live.
// ---------------------------------------------------------------------------

// The immutable content a row's hash commits to. `id` is deliberately excluded
// (a random cuid carries no integrity meaning); `seq` fixes the row's position.
export interface ChainableAudit {
  seq: number;
  applicationId: string;
  actor: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: Date;
}

const GENESIS = "GENESIS";

// Deterministic serialization of the content the hash commits to. Field order
// is fixed here so the hash is reproducible across runs and machines.
export function canonicalize(row: ChainableAudit): string {
  return JSON.stringify([
    row.seq,
    row.applicationId,
    row.actor,
    row.action,
    row.fromStatus,
    row.toStatus,
    row.reason ?? null,
    row.createdAt.toISOString(),
  ]);
}

export function computeRowHash(
  prevHash: string | null,
  row: ChainableAudit
): string {
  return createHash("sha256")
    .update(prevHash ?? GENESIS)
    .update("\n")
    .update(canonicalize(row))
    .digest("hex");
}

export interface StoredAudit extends ChainableAudit {
  prevHash: string | null;
  rowHash: string;
}

export interface VerifyResult {
  valid: boolean;
  count: number;
  brokenAt: number | null; // seq of the first row that fails verification
  reason: string | null;
}

// Recompute the chain from the beginning and report the first break, if any.
// `rows` must be ordered by ascending seq.
export function verifyChain(rows: StoredAudit[]): VerifyResult {
  let prev: string | null = null;
  for (const row of rows) {
    if ((row.prevHash ?? null) !== prev) {
      return {
        valid: false,
        count: rows.length,
        brokenAt: row.seq,
        reason:
          "prevHash does not match the previous row's hash (a row was inserted, deleted, or reordered).",
      };
    }
    const expected = computeRowHash(prev, row);
    if (expected !== row.rowHash) {
      return {
        valid: false,
        count: rows.length,
        brokenAt: row.seq,
        reason:
          "rowHash does not match the recomputed content hash (this row was altered).",
      };
    }
    prev = row.rowHash;
  }
  return { valid: true, count: rows.length, brokenAt: null, reason: null };
}
