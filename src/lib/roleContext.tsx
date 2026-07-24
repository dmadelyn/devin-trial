"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Role, ROLE_HEADER, ACTOR_HEADER } from "./constants";

// PROTOTYPE NOTE: the acting role/name live on the client and are attached to
// each API request as headers. In production the actor MUST come from a
// verified session, not from a client-controlled toggle.

interface RoleState {
  role: Role;
  actorName: string;
  setRole: (r: Role) => void;
  // fetch wrapper that attaches the actor identity headers.
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const RoleContext = createContext<RoleState | null>(null);

const ACTOR_NAMES: Record<Role, string> = {
  reviewer: "Riley Reviewer",
  viewer: "Vic Viewer",
};

const STORAGE_KEY = "kyc-role";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("reviewer");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "reviewer" || saved === "viewer") {
      setRoleState(saved);
    }
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    window.localStorage.setItem(STORAGE_KEY, r);
  }, []);

  const actorName = ACTOR_NAMES[role];

  const apiFetch = useCallback(
    (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set(ROLE_HEADER, role);
      headers.set(ACTOR_HEADER, actorName);
      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers });
    },
    [role, actorName]
  );

  const value = useMemo(
    () => ({ role, actorName, setRole, apiFetch }),
    [role, actorName, setRole, apiFetch]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
