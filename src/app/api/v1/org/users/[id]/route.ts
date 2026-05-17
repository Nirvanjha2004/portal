/**
 * PUT /api/v1/org/users/:id — update a user's role, department, and/or manager (Admin only)
 *
 * Body (all fields optional):
 *   { role?: Role, departmentId?: string | null, managerId?: string | null }
 *
 * Validation:
 *   - User cannot be set as their own manager
 *   - Referenced department and manager must exist
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];

export const PUT = withAdmin(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const userId = context?.params?.id;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Verify user exists
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { role, departmentId, managerId } = body as {
      role?: string;
      departmentId?: string | null;
      managerId?: string | null;
    };

    // Validate role if provided
    if (role !== undefined && !VALID_ROLES.includes(role as Role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate: user cannot be their own manager
    if (managerId !== undefined && managerId !== null && managerId === userId) {
      return NextResponse.json(
        { error: "A user cannot be set as their own manager" },
        { status: 422 }
      );
    }

    // Validate department exists (if provided and not null)
    if (departmentId !== undefined && departmentId !== null) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        return NextResponse.json(
          { error: `Department with id "${departmentId}" not found` },
          { status: 404 }
        );
      }
    }

    // Validate manager exists (if provided and not null)
    if (managerId !== undefined && managerId !== null) {
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager) {
        return NextResponse.json(
          { error: `Manager with id "${managerId}" not found` },
          { status: 404 }
        );
      }
    }

    // Build update payload — only include fields that were explicitly provided
    const updateData: {
      role?: Role;
      departmentId?: string | null;
      managerId?: string | null;
    } = {};

    if (role !== undefined) updateData.role = role as Role;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (managerId !== undefined) updateData.managerId = managerId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided (role, departmentId, managerId)" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        managerId: true,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
        reports: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ user: updatedUser });
  }
);
