"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/roleContext";
import type { AuditLogDTO } from "@/lib/serialize";
import { formatDateTime } from "@/lib/format";

interface VerifyResult {
  valid: boolean;
  count: number;
  brokenAt: number | null;
  reason: string | null;
}

function shortHash(h: string): string {
  return h.slice(0, 10) + "…";
}

export default function AuditPage() {
  const { apiFetch } = useRole();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/audit");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setLoading(false);
    })();
  }, [apiFetch]);

  const runVerify = async () => {
    setVerifying(true);
    setVerify(null);
    const res = await apiFetch("/api/audit/verify");
    const data: VerifyResult = await res.json();
    setVerify(data);
    setVerifying(false);
  };

  return (
    <div>
      <h1>Audit Log</h1>
      <p className="subtitle">
        Append-only, hash-chained record of every decision, newest first.
      </p>

      <div className="panel">
        <div className="verify-bar">
          <button
            className="btn"
            onClick={runVerify}
            disabled={verifying || loading}
          >
            {verifying ? "Verifying…" : "Verify integrity"}
          </button>
          {verify &&
            (verify.valid ? (
              <span className="verify-ok">
                ✓ Chain intact — {verify.count} record
                {verify.count === 1 ? "" : "s"} verified
              </span>
            ) : (
              <span className="verify-bad">
                ✗ Tampering detected at seq #{verify.brokenAt} — {verify.reason}
              </span>
            ))}
        </div>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="empty">No decisions have been recorded yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>When</th>
                <th>Actor</th>
                <th>Applicant</th>
                <th>Action</th>
                <th>Transition</th>
                <th>Reason</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="muted">{log.seq}</td>
                  <td className="muted">{formatDateTime(log.createdAt)}</td>
                  <td>{log.actor}</td>
                  <td>{log.applicantName ?? log.applicationId}</td>
                  <td>
                    <span
                      className={`badge ${
                        log.action === "approve" ? "approved" : "rejected"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="muted">
                    {log.fromStatus} → {log.toStatus}
                  </td>
                  <td>{log.reason ?? <span className="muted">—</span>}</td>
                  <td className="muted mono" title={log.rowHash}>
                    {shortHash(log.rowHash)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
