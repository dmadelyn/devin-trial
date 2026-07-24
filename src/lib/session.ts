import { isRole, Role, ROLE_HEADER, ACTOR_HEADER } from "./constants";

// ---------------------------------------------------------------------------
// Session / identity resolution.
//
// The rest of the app never reads request headers to learn *who* is acting;
// it asks for a verified Session. This indirection is the seam where real SSO
// (Okta OIDC) plugs in. Two providers implement it:
//
//   - devHeaderProvider: prototype default. Identity comes from the client role
//     toggle (headers). Fails closed to 'viewer'. Keeps the app runnable with
//     no external IdP.
//   - oktaProvider:      production. STUBBED at the token-verification boundary
//     (verifyOktaSession) — the single place to wire Okta.
//
// Select with AUTH_MODE=okta|dev (default dev).
// ---------------------------------------------------------------------------

export interface SessionUser {
  name: string;
  email: string | null;
  role: Role;
}

export interface Session {
  user: SessionUser;
}

// Thrown when SSO is selected but its integration point isn't implemented.
// withAuthorization / the session route translate this to HTTP 503.
export class SsoNotConfiguredError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "SsoNotConfiguredError";
  }
}

export type AuthMode = "dev" | "okta";

export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE === "okta" ? "okta" : "dev";
}

interface AuthProvider {
  readonly name: string;
  getSession(req: Request): Promise<Session | null>;
}

const DEFAULT_ACTOR_NAME = "Unknown Analyst";

// PROTOTYPE ONLY. Identity is client-controlled; never use in production.
const devHeaderProvider: AuthProvider = {
  name: "dev-headers",
  async getSession(req: Request): Promise<Session> {
    const rawRole = req.headers.get(ROLE_HEADER);
    const role: Role = isRole(rawRole) ? rawRole : "viewer"; // fail closed
    const name = req.headers.get(ACTOR_HEADER)?.trim() || DEFAULT_ACTOR_NAME;
    return { user: { name, email: null, role } };
  },
};

// =========================================================================
// OKTA INTEGRATION SEAM (STUB)
//
// This is the ONE function to implement to go live with Okta SSO. On each
// request it must return the verified session, or null if unauthenticated:
//
//   1. Read the session established by the OIDC redirect flow — typically a
//      signed session cookie, or an `Authorization: Bearer <access_token>`.
//   2. Verify the token against Okta's JWKS: signature, `iss` (OKTA_ISSUER),
//      `aud` (OKTA_AUDIENCE), and expiry. (e.g. `jose`'s createRemoteJWKSet +
//      jwtVerify against `${OKTA_ISSUER}/v1/keys`.)
//   3. Map Okta group / app-role claims to our Role ('reviewer' | 'viewer').
//   4. Return { user: { name, email, role } }.
//
// Also implement the OIDC login/callback endpoints (see
// src/app/api/auth/[...]) to establish that session.
//
// Required env: OKTA_ISSUER, OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, OKTA_AUDIENCE.
// =========================================================================
async function verifyOktaSession(_req: Request): Promise<Session | null> {
  throw new SsoNotConfiguredError(
    "Okta SSO is selected (AUTH_MODE=okta) but not implemented. " +
      "Wire token verification in verifyOktaSession() (src/lib/session.ts) and set OKTA_* env vars."
  );
}

const oktaProvider: AuthProvider = {
  name: "okta",
  getSession: verifyOktaSession,
};

function activeProvider(): AuthProvider {
  return getAuthMode() === "okta" ? oktaProvider : devHeaderProvider;
}

// Resolve the verified session for a request (or null if unauthenticated).
export function getServerSession(req: Request): Promise<Session | null> {
  return activeProvider().getSession(req);
}
