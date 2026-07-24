import type { Application, AuditLog } from "@prisma/client";
import { RISK_FLAGS, RiskFlag } from "./constants";

export interface ApplicationDTO {
  id: string;
  applicantName: string;
  dob: string;
  mockDocumentId: string;
  address: string;
  riskFlags: RiskFlag[];
  status: string;
  submittedAt: string;
}

export interface AuditLogDTO {
  id: string;
  seq: number;
  applicationId: string;
  applicantName?: string;
  actor: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: string;
  prevHash: string | null;
  rowHash: string;
}

function parseRiskFlags(raw: string): RiskFlag[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is RiskFlag =>
        typeof f === "string" && (RISK_FLAGS as readonly string[]).includes(f)
    );
  } catch {
    return [];
  }
}

export function serializeApplication(a: Application): ApplicationDTO {
  return {
    id: a.id,
    applicantName: a.applicantName,
    dob: a.dob.toISOString(),
    mockDocumentId: a.mockDocumentId,
    address: a.address,
    riskFlags: parseRiskFlags(a.riskFlags),
    status: a.status,
    submittedAt: a.submittedAt.toISOString(),
  };
}

export function serializeAuditLog(
  log: AuditLog & { application?: { applicantName: string } }
): AuditLogDTO {
  return {
    id: log.id,
    seq: log.seq,
    applicationId: log.applicationId,
    applicantName: log.application?.applicantName,
    actor: log.actor,
    action: log.action,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    reason: log.reason,
    createdAt: log.createdAt.toISOString(),
    prevHash: log.prevHash,
    rowHash: log.rowHash,
  };
}
