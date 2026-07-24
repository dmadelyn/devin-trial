// Shared route-handler types for App Router API routes.

export type RouteContext = { params: Record<string, string> };

export type NextRequestHandler = (
  req: Request,
  ctx: RouteContext
) => Promise<Response> | Response;
