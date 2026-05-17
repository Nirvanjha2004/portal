/**
 * PUT    /api/v1/goal-sheets/:id/goals/:goalId  — update a goal in a DRAFT sheet
 * DELETE /api/v1/goal-sheets/:id/goals/:goalId  — remove a goal from a DRAFT sheet
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { UoM } from "@prisma/client";

const VALID_UOM: UoM[] = [
  "NUMERIC_MIN",
  "NUMERIC_MAX",
  "PERCENTAGE_MIN",
  "PERCENTAGE_MAX",
  "TIMELINE",
  "ZERO_BASED",
];

// ─── Shared access check ──────────────────────────────────────────────────────

async function resolveGoalAccess(
  sheetId: string,
  goalId: string,
  userId: string,
  role: string
): Promise<
  | {
      ok: true;
      goal: NonNullable<
        Awaited<ReturnType<typeof prisma.goal.findFirst>>
      >;
      sheet: NonNullable<
        Awaited<ReturnType<typeof prisma.goalSheet.findUnique>>
      >;
    }
  | { ok: false; status: number; error: string }
> {
  const sheet = await prisma.goalSheet.findUnique({
    where: { id: sheetId },
    include: { employee: { select: { id: true, managerId: true } } },
  });

  if (!sheet) {
    return { ok: false, status: 404, error: "Goal sheet not found" };
  }

  // Ownership check
  const isOwn = sheet.employeeId === userId;
  const isManagerOfEmployee =
    role === "MANAGER" && sheet.employee.managerId === userId;
  const isAdmin = role === "ADMIN";

  if (!isOwn && !isManagerOfEmployee && !isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (sheet.status !== "DRAFT") {
    return {
      ok: false,
      status: 422,
      error: `Cannot modify goals on a sheet with status "${sheet.status}". Only DRAFT sheets can be edited.`,
    };
  }

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, goalSheetId: sheetId },
  });

  if (!goal) {
    return { ok: false, status: 404, error: "Goal not found in this sheet" };
  }

  return { ok: true, goal, sheet };
}

// ─── PUT /api/v1/goal-sheets/:id/goals/:goalId ───────────────────────────────

export const PUT = withEmployee(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    const goalId = context?.params?.goalId;

    if (!id || !goalId) {
      return NextResponse.json(
        { error: "Missing id or goalId" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    const access = await resolveGoalAccess(id, goalId, userId, role);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const { goal } = access;

    // Shared goals: title and target are read-only for recipients
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { thrustAreaId, title, description, uom, target, weightage } =
      body as {
        thrustAreaId?: string;
        title?: string;
        description?: string;
        uom?: string;
        target?: string;
        weightage?: number;
      };

    const data: Record<string, unknown> = {};

    if (thrustAreaId !== undefined) {
      if (typeof thrustAreaId !== "string") {
        return NextResponse.json(
          { error: "thrustAreaId must be a string" },
          { status: 400 }
        );
      }
      const thrustArea = await prisma.thrustArea.findUnique({
        where: { id: thrustAreaId },
      });
      if (!thrustArea) {
        return NextResponse.json(
          { error: "Thrust area not found" },
          { status: 404 }
        );
      }
      data.thrustAreaId = thrustAreaId;
    }

    if (title !== undefined) {
      // Shared goal recipients cannot modify title
      if (goal.isReadOnly) {
        return NextResponse.json(
          { error: "Cannot modify the title of a shared goal" },
          { status: 403 }
        );
      }
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Goal title must be a non-empty string" },
          { status: 400 }
        );
      }
      if (title.trim().length > 200) {
        return NextResponse.json(
          { error: "Goal title must not exceed 200 characters" },
          { status: 400 }
        );
      }
      data.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || description.trim().length === 0) {
        return NextResponse.json(
          { error: "Goal description must be a non-empty string" },
          { status: 400 }
        );
      }
      if (description.trim().length > 1000) {
        return NextResponse.json(
          { error: "Goal description must not exceed 1000 characters" },
          { status: 400 }
        );
      }
      data.description = description.trim();
    }

    if (uom !== undefined) {
      if (!VALID_UOM.includes(uom as UoM)) {
        return NextResponse.json(
          { error: `uom must be one of: ${VALID_UOM.join(", ")}` },
          { status: 400 }
        );
      }
      data.uom = uom as UoM;
    }

    if (target !== undefined) {
      // Shared goal recipients cannot modify target
      if (goal.isReadOnly) {
        return NextResponse.json(
          { error: "Cannot modify the target of a shared goal" },
          { status: 403 }
        );
      }
      if (typeof target !== "string" || target.trim().length === 0) {
        return NextResponse.json(
          { error: "Goal target must be a non-empty string" },
          { status: 400 }
        );
      }
      data.target = target.trim();
    }

    if (weightage !== undefined) {
      if (typeof weightage !== "number" || !Number.isInteger(weightage)) {
        return NextResponse.json(
          { error: "Weightage must be an integer" },
          { status: 400 }
        );
      }
      if (weightage < 10) {
        return NextResponse.json(
          { error: "Weightage must be at least 10%" },
          { status: 400 }
        );
      }
      if (weightage > 100) {
        return NextResponse.json(
          { error: "Weightage must not exceed 100%" },
          { status: 400 }
        );
      }
      data.weightage = weightage;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data,
      include: { thrustArea: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ goal: updated });
  }
);

// ─── DELETE /api/v1/goal-sheets/:id/goals/:goalId ──────────────────────────

export const DELETE = withEmployee(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    const goalId = context?.params?.goalId;

    if (!id || !goalId) {
      return NextResponse.json(
        { error: "Missing id or goalId" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    const access = await resolveGoalAccess(id, goalId, userId, role);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    await prisma.goal.delete({ where: { id: goalId } });

    return NextResponse.json({ success: true });
  }
);
