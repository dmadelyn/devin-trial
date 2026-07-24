"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRole } from "@/lib/roleContext";
import { STATUSES } from "@/lib/constants";
import type { ApplicationDTO } from "@/lib/serialize";
import { formatDate } from "@/lib/format";

type Filter = "all" | (typeof STATUSES)[number];

const FILTER_STORAGE_KEY = "kyc-queue-filter";

function isFilter(v: string | null): v is Filter {
  return v === "all" || (STATUSES as readonly string[]).includes(v ?? "");
}

export default function QueuePage() {
  const { role, apiFetch } = useRole();
  const [filter, setFilterState] = useState<Filter>("all");
  const [apps, setApps] = useState<ApplicationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Restore the last-used filter so it survives navigation to other pages.
  useEffect(() => {
    const saved = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (isFilter(saved)) setFilterState(saved);
  }, []);

  const setFilter = useCallback((f: Filter) => {
    setFilterState(f);
    window.localStorage.setItem(FILTER_STORAGE_KEY, f);
  }, []);

  const load = useCallback(async () => {
    // Guard against out-of-order responses: only the latest request applies.
    // (On mount the default "all" fetch and the restored filter's fetch race.)
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const qs = filter === "all" ? "" : `?status=${filter}`;
    const res = await apiFetch(`/api/applications${qs}`);
    const data = await res.json();
    if (requestId !== requestIdRef.current) return;
    setApps(data.applications ?? []);
    setLoading(false);
  }, [filter, apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch after a decision so rows that no longer match the active filter
  // drop out (and statuses stay in sync with the server).
  const onDecided = () => {
    setExpandedId(null);
    load();
  };

  return (
    <div>
      <h1>Review Queue</h1>
      <p className="subtitle">
        Applications that automated verification could not clear.
      </p>

      <div className="panel">
        <div className="toolbar">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="muted">{apps.length} shown</span>
        </div>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : apps.length === 0 ? (
          <div className="empty">No applications match this filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Submitted</th>
                <th>Risk Flags</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  expanded={expandedId === app.id}
                  canReview={role === "reviewer"}
                  onToggle={() =>
                    setExpandedId((id) => (id === app.id ? null : app.id))
                  }
                  onDecided={onDecided}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ApplicationRow({
  app,
  expanded,
  canReview,
  onToggle,
  onDecided,
}: {
  app: ApplicationDTO;
  expanded: boolean;
  canReview: boolean;
  onToggle: () => void;
  onDecided: () => void;
}) {
  return (
    <>
      <tr className="row-clickable" onClick={onToggle}>
        <td>
          <strong>{app.applicantName}</strong>
        </td>
        <td>{formatDate(app.submittedAt)}</td>
        <td>
          {app.riskFlags.length === 0 ? (
            <span className="muted">—</span>
          ) : (
            <div className="flags">
              {app.riskFlags.map((f) => (
                <span key={f} className="flag">
                  {f}
                </span>
              ))}
            </div>
          )}
        </td>
        <td>
          <span className={`badge ${app.status}`}>{app.status}</span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ padding: 0 }}>
            <DetailPanel
              app={app}
              canReview={canReview}
              onDecided={onDecided}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailPanel({
  app,
  canReview,
  onDecided,
}: {
  app: ApplicationDTO;
  canReview: boolean;
  onDecided: () => void;
}) {
  const { apiFetch } = useRole();
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decide = async (action: "approve" | "reject") => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/applications/${app.id}/decision`, {
        method: "POST",
        body: JSON.stringify(
          action === "reject" ? { action, reason } : { action }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setShowReject(false);
      setReason("");
      onDecided();
    } finally {
      setBusy(false);
    }
  };

  const isPending = app.status === "pending";

  return (
    <div className="detail">
      <div className="detail-grid">
        <Field label="Applicant name" value={app.applicantName} />
        <Field label="Date of birth" value={formatDate(app.dob)} />
        <Field label="Document ID" value={app.mockDocumentId} />
        <Field label="Submitted" value={formatDate(app.submittedAt)} />
        <Field label="Address" value={app.address} />
        <Field
          label="Status"
          value={<span className={`badge ${app.status}`}>{app.status}</span>}
        />
        <div>
          <div className="label">Risk flags</div>
          <div className="value">
            {app.riskFlags.length === 0 ? (
              <span className="muted">None</span>
            ) : (
              <div className="flags">
                {app.riskFlags.map((f) => (
                  <span key={f} className="flag">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isPending ? (
        <p className="muted">
          This application has already been {app.status}. No further action.
        </p>
      ) : !canReview ? (
        <p className="muted">
          You are in read-only (Viewer) mode. Switch to Reviewer to take action.
        </p>
      ) : (
        <div className="actions">
          <button
            className="btn approve"
            disabled={busy}
            onClick={() => decide("approve")}
          >
            Approve
          </button>
          {!showReject ? (
            <button
              className="btn reject"
              disabled={busy}
              onClick={() => setShowReject(true)}
            >
              Reject…
            </button>
          ) : (
            <div className="reject-box">
              <textarea
                placeholder="Reason for rejection (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="actions">
                <button
                  className="btn reject"
                  disabled={busy}
                  onClick={() => decide("reject")}
                >
                  Confirm reject
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setShowReject(false);
                    setReason("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
