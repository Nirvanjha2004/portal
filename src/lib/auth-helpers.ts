/**
 * RBAC helpers for API routes.
 *
 * Usage:
 *   export const GET = withRole([Role.ADMIN], async (req) => { ... });
 */
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@prisma/client";

type RouteHandler = (
  req: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function that wraps a Next.js App Router route handler
 * with authentication and role-based access control.
 *
 * Returns 401 if the user is not authenticated.
 * Returns 403 if the user's role is not in the allowed list.
 */
export function withRole(roles: Role[], handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    if (!roles.includes(session.user.role as Role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(req, context);
  };
}

/**
 * Convenience wrappers for common role combinations.
 */
export const withAdmin = (handler: RouteHandler) =>
  withRole(["ADMIN"] as Role[], handler);

export const withManager = (handler: RouteHandler) =>
  withRole(["MANAGER", "ADMIN"] as Role[], handler);

export const withEmployee = (handler: RouteHandler) =>
  withRole(["EMPLOYEE", "MANAGER", "ADMIN"] as Role[], handler);
