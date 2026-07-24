import { NextResponse } from "next/server";
import {
  getServerSession,
  getAuthMode,
  SsoNotConfiguredError,
} from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/auth/session — the server's view of the current identity. The UI
// reads this to display who is acting; it proves identity is resolved
// server-side (via the active auth provider), not asserted by the client.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(req);
    return NextResponse.json({
      authMode: getAuthMode(),
      authenticated: session !== null,
      user: session?.user ?? null,
    });
  } catch (e) {
    if (e instanceof SsoNotConfiguredError) {
      return NextResponse.json(
        {
          authMode: getAuthMode(),
          authenticated: false,
          user: null,
          error: e.message,
        },
        { status: e.status }
      );
    }
    throw e;
  }
}
