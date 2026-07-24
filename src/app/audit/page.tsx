"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/roleContext";
import type { AuditLogDTO } from "@/lib/serialize";
import { formatDateTime } from "@/lib/format";

export default function AuditPage() {
  const { apiFetch } = useRole();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/audit");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setLoading(false);
    })();
  }, [apiFetch]);

  return (
    <div>
      <h1>Audit Log</h1>
      <p className="subtitle">
        Append-only record of every decision, newest first.
      </p>

      <div className="panel">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="empty">No decisions have been recorded yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Applicant</th>
                <th>Action</th>
                <th>Transition</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
