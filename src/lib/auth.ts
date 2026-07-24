import { NextRequestHandler, RouteContext } from "./types";
import { NextResponse } from "next/server";
import { Role } from "./constants";
import { getServerSession, SsoNotConfiguredError } from "./session";

// ---------------------------------------------------------------------------
// Reusable authorization concern.
//
// Role checking is centralized here so every tool/route enforces access the
// same way instead of re-implementing it per screen. The two exports are:
//   - getActor(req):        the verified acting identity (or null)
//   - withAuthorization():  wrap a route handler behind a required role
//
// The identity comes from a verified Session (src/lib/session.ts), NOT directly
// from request headers — that indirection is where real SSO (Okta) plugs in.
// In the prototype's default dev mode the session is derived from the client
// role toggle; production swaps in the Okta provider with no change here.
// ---------------------------------------------------------------------------

export interface Actor {
  name: string;
  role: Role;
}

export async function getActor(req: Request): Promise<Actor | null> {
  const session = await getServerSession(req);
  if (!session) return null;
  return { name: session.user.name, role: session.user.role };
}

// Higher-order wrapper: only invokes `handler` if the request carries a
// verified session holding `required` role. Otherwise short-circuits with:
//   401 — unauthenticated (no valid session)
//   403 — authenticated but wrong role
//   503 — SSO selected but not configured
export function withAuthorization(
  required: Role,
  handler: (req: Request, actor: Actor, ctx: RouteContext) => Promise<Response> | Response
): NextRequestHandler {
  return async (req: Request, ctx: RouteContext) => {
    let actor: Actor | null;
    try {
      actor = await getActor(req);
    } catch (e) {
      if (e instanceof SsoNotConfiguredError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actor.role !== required) {
      return NextResponse.json(
        { error: `Forbidden: '${required}' role required` },
        { status: 403 }
      );
    }
    return handler(req, actor, ctx);
  };
}
