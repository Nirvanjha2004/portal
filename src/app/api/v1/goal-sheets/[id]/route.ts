/**
 * GET /api/v1/goal-sheets/:id  — get a sheet with all goals (enforces ownership or manager relationship)
 * PUT /api/v1/goal-sheets/:id  — update a DRAFT sheet (blocked if status ≠ DRAFT)
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ─── Ownership / access check helper ─────────────────────────────────────────

async function canAccessSheet(
  sheetId: string,
  userId: string,
  role: string
): Promise<
  | {
      allowed: true;
      sheet: Awaited<ReturnType<typeof fetchSheet>>;
    }
  | { allowed: false; status: number; error: string }
> {
  const sheet = await fetchSheet(sheetId);

  if (!sheet) {
    return { allowed: false, status: 404, error: "Goal sheet not found" };
  }

  // Employee can only access their own sheet
  if (role === "EMPLOYEE" && sheet.employeeId !== userId) {
    return { allowed: false, status: 403, error: "Forbidden" };
  }

  // Manager can access their direct reports' sheets (and their own)
  if (role === "MANAGER") {
    const isOwn = sheet.employeeId === userId;
    const isDirectReport = sheet.employee.managerId === userId;
    if (!isOwn && !isDirectReport) {
      return { allowed: false, status: 403, error: "Forbidden" };
    }
  }

  // ADMIN can access all sheets
  return { allowed: true, sheet };
}

async function fetchSheet(sheetId: string) {
  return prisma.goalSheet.findUnique({
    where: { id: sheetId },
    include: {
      employee: {
        select: { id: true, name: true, email: true, managerId: true },
      },
      cycle: { select: { id: true, name: true, isActive: true } },
      goals: {
        include: {
          thrustArea: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ─── GET /api/v1/goal-sheets/:id ─────────────────────────────────────────────

export const GET = withEmployee(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing sheet id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    const access = await canAccessSheet(id, userId, role);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    return NextResponse.json({ goalSheet: access.sheet });
  }
);

// ─── PUT /api/v1/goal-sheets/:id ─────────────────────────────────────────────

export const PUT = withEmployee(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing sheet id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    const access = await canAccessSheet(id, userId, role);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const sheet = access.sheet!;

    // Only DRAFT sheets can be updated
    if (sheet.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Goal sheet cannot be updated because its status is "${sheet.status}". Only DRAFT sheets can be edited.`,
        },
        { status: 422 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Currently the only updatable top-level field on a sheet is reworkComment
    // (goals are managed via the goals sub-routes)
    const { reworkComment } = body as { reworkComment?: string };

    const data: Record<string, unknown> = {};
    if (reworkComment !== undefined) {
      if (typeof reworkComment !== "string") {
        return NextResponse.json(
          { error: "reworkComment must be a string" },
          { status: 400 }
        );
      }
      if (reworkComment.length > 2000) {
        return NextResponse.json(
          { error: "reworkComment must not exceed 2000 characters" },
          { status: 400 }
        );
      }
      data.reworkComment = reworkComment;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const updated = await prisma.goalSheet.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, isActive: true } },
        goals: {
          include: { thrustArea: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ goalSheet: updated });
  }
);
