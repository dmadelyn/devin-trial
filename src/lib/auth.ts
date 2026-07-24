import { NextRequestHandler, RouteContext } from "./types";
import { NextResponse } from "next/server";
import { isRole, Role, ROLE_HEADER, ACTOR_HEADER } from "./constants";

// ---------------------------------------------------------------------------
// Reusable authorization concern.
//
// Role checking is centralized here so every tool/route enforces access the
// same way instead of re-implementing it per screen. The two exports are:
//   - getActor(req):        read the acting identity from the request
//   - withAuthorization():  wrap a route handler behind a required role
//
// PROTOTYPE NOTE: the actor identity is read from request headers set by the
// client-side role toggle. In production this MUST come from a verified
// session (signed cookie / SSO), never from a client-supplied header.
// ---------------------------------------------------------------------------

export interface Actor {
  name: string;
  role: Role;
}

const DEFAULT_ACTOR_NAME = "Unknown Analyst";

export function getActor(req: Request): Actor {
  const rawRole = req.headers.get(ROLE_HEADER);
  const role: Role = isRole(rawRole) ? rawRole : "viewer"; // fail closed
  const name = req.headers.get(ACTOR_HEADER)?.trim() || DEFAULT_ACTOR_NAME;
  return { name, role };
}

// Higher-order wrapper: only invokes `handler` if the actor holds `required`
// role; otherwise short-circuits with 403. The authorized actor is injected.
export function withAuthorization(
  required: Role,
  handler: (req: Request, actor: Actor, ctx: RouteContext) => Promise<Response> | Response
): NextRequestHandler {
  return async (req: Request, ctx: RouteContext) => {
    const actor = getActor(req);
    if (actor.role !== required) {
      return NextResponse.json(
        { error: `Forbidden: '${required}' role required` },
        { status: 403 }
      );
    }
    return handler(req, actor, ctx);
  };
}
