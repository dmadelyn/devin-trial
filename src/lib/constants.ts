// Allowed-value definitions. SQLite has no native enums, so these are the
// single source of truth and are validated in code wherever values are accepted.

export const STATUSES = ["pending", "approved", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const ACTIONS = ["approve", "reject"] as const;
export type Action = (typeof ACTIONS)[number];

export const RISK_FLAGS = [
  "name_mismatch",
  "watchlist_hit",
  "blurry_document",
  "duplicate_identity",
  "address_unverifiable",
] as const;
export type RiskFlag = (typeof RISK_FLAGS)[number];

export const ROLES = ["reviewer", "viewer"] as const;
export type Role = (typeof ROLES)[number];

// Headers carrying the acting identity. See auth.ts for the prototype caveat.
export const ROLE_HEADER = "x-actor-role";
export const ACTOR_HEADER = "x-actor-name";

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export function isAction(v: unknown): v is Action {
  return typeof v === "string" && (ACTIONS as readonly string[]).includes(v);
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

// Maps a decision action to the resulting application status.
export const ACTION_TO_STATUS: Record<Action, Status> = {
  approve: "approved",
  reject: "rejected",
};
