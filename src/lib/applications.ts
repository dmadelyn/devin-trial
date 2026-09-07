import { prisma } from "./prisma";
import { RISK_FLAGS, RiskFlag } from "./constants";

// ---------------------------------------------------------------------------
// Application ingestion.
//
// New cases enter the queue here. In production this is the seam the upstream
// automated verification / IDV vendor calls (webhook) when it *couldn't* clear
// an identity — never a hand-entered form. The prototype exposes it as POST
// /api/applications so cases can be pushed in without reseeding.
//
// Ingestion only ever creates 'pending' applications; it never sets a status or
// touches the audit trail (that is exclusively recordDecision's job).
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface NewApplication {
  applicantName: string;
  dob: Date;
  mockDocumentId: string;
  address: string;
  riskFlags: RiskFlag[];
}

function requireString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new ValidationError(`${field} is required.`);
  }
  return v.trim();
}

// Parse an ISO-8601 date (`YYYY-MM-DD`, optionally followed by a time/offset)
// to midnight UTC using the calendar date as written, independent of any
// offset in the input or the server's timezone. Rejects non-existent dates.
function parseDateOnly(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

// Validate and normalize a raw request body into a NewApplication.
export function parseNewApplication(body: unknown): NewApplication {
  const b = (body ?? {}) as Record<string, unknown>;

  const applicantName = requireString(b.applicantName, "applicantName");
  const address = requireString(b.address, "address");

  const dobRaw = requireString(b.dob, "dob");
  const dob = parseDateOnly(dobRaw);
  if (dob === null) {
    throw new ValidationError("dob must be a valid YYYY-MM-DD date (e.g. 1990-04-12).");
  }
  if (dob.getTime() > Date.now()) {
    throw new ValidationError("dob cannot be in the future.");
  }

  // Optional: auto-generate a mock document id if the caller omits one.
  const mockDocumentId =
    typeof b.mockDocumentId === "string" && b.mockDocumentId.trim() !== ""
      ? b.mockDocumentId.trim()
      : `DOC-${Math.floor(100000 + Math.random() * 900000)}`;

  // Optional risk flags; every value must be in the allowed set.
  let riskFlags: RiskFlag[] = [];
  if (b.riskFlags !== undefined) {
    if (!Array.isArray(b.riskFlags)) {
      throw new ValidationError("riskFlags must be an array.");
    }
    for (const f of b.riskFlags) {
      if (typeof f !== "string" || !(RISK_FLAGS as readonly string[]).includes(f)) {
        throw new ValidationError(`Invalid risk flag: ${String(f)}`);
      }
    }
    riskFlags = Array.from(new Set(b.riskFlags as RiskFlag[]));
  }

  return { applicantName, dob, mockDocumentId, address, riskFlags };
}

export async function createApplication(input: NewApplication) {
  return prisma.application.create({
    data: {
      applicantName: input.applicantName,
      dob: input.dob,
      mockDocumentId: input.mockDocumentId,
      address: input.address,
      riskFlags: JSON.stringify(input.riskFlags),
      status: "pending", // ingestion always creates pending cases
    },
  });
}
