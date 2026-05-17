/**
 * POST /api/v1/goal-sheets/:id/submit
 *
 * Changes status from DRAFT → PENDING_APPROVAL.
 * Runs weightage validation before accepting the submission.
 * Records submittedAt timestamp.
 * Dispatches notification to the manager.
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateWeightage, ValidationError } from "@/lib/validation";
import { dispatch } from "@/services/notification.service";

export const POST = withEmployee(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing sheet id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;

    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, managerId: true } },
        goals: true,
      },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    }

    // Only the owning employee can submit
    if (sheet.employeeId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sheet.status !== "DRAFT" && sheet.status !== "RETURNED") {
      return NextResponse.json(
        { error: `Cannot submit a sheet with status "${sheet.status}"` },
        { status: 422 }
      );
    }

    // Weightage validation
    try {
      validateWeightage(sheet.goals);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }

    const updated = await prisma.goalSheet.update({
      where: { id },
      data: {
        status: "PENDING_APPROVAL",
        submittedAt: new Date(),
      },
      include: {
        employee: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true, isActive: true } },
        goals: { include: { thrustArea: { select: { id: true, name: true } } } },
      },
    });

    // Dispatch notification to manager
    if (sheet.employee.managerId) {
      await dispatch(sheet.employee.managerId, "GOAL_SHEET_SUBMITTED", {
        title: "Goal Sheet Submitted",
        body: `${updated.employee.name} has submitted their goal sheet for ${updated.cycle.name}.`,
        deepLink: `/approvals/${updated.id}`,
      });
    }

    return NextResponse.json({ goalSheet: updated });
  }
);
