/**
 * GET  /api/v1/goal-sheets  — list own sheets (Employee) or team sheets (Manager/Admin)
 * POST /api/v1/goal-sheets  — create a DRAFT sheet for the authenticated employee in the active cycle
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ─── GET /api/v1/goal-sheets ──────────────────────────────────────────────────

export const GET = withEmployee(async (_req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  if (role === "MANAGER" || role === "ADMIN") {
    // Manager/Admin: return sheets for all direct reports
    const sheets = await prisma.goalSheet.findMany({
      where: {
        employee: {
          managerId: userId,
        },
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, isActive: true } },
        _count: { select: { goals: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Admin can also see their own sheets
    const ownSheets = await prisma.goalSheet.findMany({
      where: { employeeId: userId },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, isActive: true } },
        _count: { select: { goals: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Merge, deduplicate by id
    const allSheets = [...sheets, ...ownSheets];
    const seen = new Set<string>();
    const deduplicated = allSheets.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    return NextResponse.json({ goalSheets: deduplicated });
  }

  // Employee: return only own sheets
  const goalSheets = await prisma.goalSheet.findMany({
    where: { employeeId: userId },
    include: {
      cycle: { select: { id: true, name: true, isActive: true } },
      _count: { select: { goals: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ goalSheets });
});

// ─── POST /api/v1/goal-sheets ─────────────────────────────────────────────────

export const POST = withEmployee(async (_req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;

  // Find the active cycle
  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { isActive: true },
  });

  if (!activeCycle) {
    return NextResponse.json(
      { error: "No active performance cycle found" },
      { status: 422 }
    );
  }

  // Enforce @@unique([employeeId, cycleId])
  const existing = await prisma.goalSheet.findUnique({
    where: {
      employeeId_cycleId: {
        employeeId: userId,
        cycleId: activeCycle.id,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: "A goal sheet already exists for this employee in the active cycle",
        goalSheetId: existing.id,
      },
      { status: 409 }
    );
  }

  const goalSheet = await prisma.goalSheet.create({
    data: {
      employeeId: userId,
      cycleId: activeCycle.id,
      status: "DRAFT",
    },
    include: {
      cycle: { select: { id: true, name: true, isActive: true } },
      goals: true,
    },
  });

  return NextResponse.json({ goalSheet }, { status: 201 });
});
