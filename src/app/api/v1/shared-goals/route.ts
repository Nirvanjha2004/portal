/**
 * GET  /api/v1/shared-goals  — list shared goals (Admin/Manager only)
 * POST /api/v1/shared-goals  — create a shared goal and push to selected employees (Admin/Manager only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateWeightage } from "@/lib/validation";

// ─── GET /api/v1/shared-goals ─────────────────────────────────────────────────

export const GET = withManager(async (_req: NextRequest) => {
  const sharedGoals = await prisma.sharedGoal.findMany({
    include: {
      linkedGoals: {
        select: { id: true, goalSheetId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sharedGoals });
});

// ─── POST /api/v1/shared-goals ────────────────────────────────────────────────

export const POST = withManager(async (req: NextRequest) => {
  const session = await auth();
  const createdById = session!.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    thrustAreaId,
    title,
    description,
    uom,
    target,
    employeeIds = [],
  } = body as {
    thrustAreaId?: string;
    title?: string;
    description?: string;
    uom?: string;
    target?: string;
    employeeIds?: string[];
  };

  // Validate required fields
  if (!thrustAreaId || typeof thrustAreaId !== "string") {
    return NextResponse.json(
      { error: "thrustAreaId is required" },
      { status: 400 }
    );
  }

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (title.length > 200) {
    return NextResponse.json(
      { error: "title must not exceed 200 characters" },
      { status: 400 }
    );
  }

  if (!description || typeof description !== "string") {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  if (description.length > 1000) {
    return NextResponse.json(
      { error: "description must not exceed 1000 characters" },
      { status: 400 }
    );
  }

  if (!uom || typeof uom !== "string") {
    return NextResponse.json({ error: "uom is required" }, { status: 400 });
  }

  if (!target || typeof target !== "string") {
    return NextResponse.json({ error: "target is required" }, { status: 400 });
  }

  if (!Array.isArray(employeeIds)) {
    return NextResponse.json(
      { error: "employeeIds must be an array" },
      { status: 400 }
    );
  }

  // Verify thrust area exists
  const thrustArea = await prisma.thrustArea.findUnique({
    where: { id: thrustAreaId },
  });

  if (!thrustArea) {
    return NextResponse.json(
      { error: "Thrust area not found" },
      { status: 404 }
    );
  }

  // Create the shared goal
  const sharedGoal = await prisma.sharedGoal.create({
    data: {
      createdById,
      thrustAreaId,
      title,
      description,
      uom: uom as any, // Trust the UoM enum
      target,
    },
  });

  // Push the shared goal to selected employees
  const failedEmployees: Array<{ employeeId: string; reason: string }> = [];
  const successfulGoalIds: string[] = [];

  for (const employeeId of employeeIds) {
    try {
      // Find the employee's goal sheet in the active cycle
      const sheet = await prisma.goalSheet.findFirst({
        where: {
          employeeId,
          cycle: { isActive: true },
        },
        include: {
          goals: true,
        },
      });

      if (!sheet) {
        failedEmployees.push({
          employeeId,
          reason: "No goal sheet found in active cycle",
        });
        continue;
      }

      // Check if sheet is full or already approved
      if (sheet.goals.length >= 8) {
        failedEmployees.push({
          employeeId,
          reason: "Goal sheet already has 8 goals (maximum reached)",
        });
        continue;
      }

      if (sheet.status === "APPROVED") {
        failedEmployees.push({
          employeeId,
          reason: "Goal sheet is already approved and locked",
        });
        continue;
      }

      // Create the goal with isReadOnly = true and sharedGoalId set
      const goal = await prisma.goal.create({
        data: {
          goalSheetId: sheet.id,
          thrustAreaId,
          title,
          description,
          uom: uom as any,
          target,
          weightage: 0, // Placeholder; will be updated by recipient
          isShared: true,
          isReadOnly: true,
          sharedGoalId: sharedGoal.id,
        },
      });

      successfulGoalIds.push(goal.id);
    } catch (err) {
      failedEmployees.push({
        employeeId,
        reason: "An error occurred while creating the goal",
      });
    }
  }

  return NextResponse.json({
    sharedGoal,
    successfulGoalCount: successfulGoalIds.length,
    failedEmployees,
  });
});
