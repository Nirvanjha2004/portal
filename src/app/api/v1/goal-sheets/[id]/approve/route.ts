/**
 * POST /api/v1/goal-sheets/:id/approve
 *
 * Manager approves a PENDING_APPROVAL sheet.
 * Sets status → APPROVED, lockDate = now().
 * Validates the manager owns the employee.
 * Dispatches notification to the employee.
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { dispatch } from "@/services/notification.service";

export const POST = withManager(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing sheet id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: { employee: { select: { id: true, managerId: true } } },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    }

    // Manager must own the employee (or be Admin)
    if (role === "MANAGER" && sheet.employee.managerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sheet.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `Cannot approve a sheet with status "${sheet.status}"` },
        { status: 422 }
      );
    }

    const updated = await prisma.goalSheet.update({
      where: { id },
      data: {
        status: "APPROVED",
        lockDate: new Date(),
      },
      include: {
        employee: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true, isActive: true } },
        goals: { include: { thrustArea: { select: { id: true, name: true } } } },
      },
    });

    // Dispatch notification to employee
    await dispatch(sheet.employeeId, "GOAL_SHEET_APPROVED", {
      title: "Goal Sheet Approved",
      body: `Your goal sheet for ${updated.cycle.name} has been approved.`,
      deepLink: `/goals/${updated.id}`,
    });

    return NextResponse.json({ goalSheet: updated });
  }
);
