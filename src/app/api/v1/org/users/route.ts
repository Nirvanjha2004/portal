/**
 * GET /api/v1/org/users — list users with optional filters (Admin only)
 *
 * Query params:
 *   ?role=EMPLOYEE|MANAGER|ADMIN
 *   ?departmentId=<id>
 *   ?managerId=<id>
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];

export const GET = withAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const roleParam = searchParams.get("role");
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const managerId = searchParams.get("managerId") ?? undefined;

  // Validate role filter if provided
  if (roleParam && !VALID_ROLES.includes(roleParam as Role)) {
    return NextResponse.json(
      { error: `Invalid role filter. Must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  const users = await prisma.user.findMany({
    where: {
      ...(roleParam ? { role: roleParam as Role } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(managerId ? { managerId } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      departmentId: true,
      managerId: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true, email: true } },
      _count: { select: { reports: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
});
