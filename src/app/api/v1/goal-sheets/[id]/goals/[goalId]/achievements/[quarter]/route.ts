/**
 * GET /api/v1/goal-sheets/:id/goals/:goalId/achievements/:quarter
 * PUT /api/v1/goal-sheets/:id/goals/:goalId/achievements/:quarter
 *
 * Get or upsert quarterly achievement for a goal.
 * PUT validates window is open, computes progress score, propagates to linked shared goals.
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeProgressScore } from "@/lib/progress-score";

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withEmployee(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    const goalId = context?.params?.goalId;
    const quarter = context?.params?.quarter?.toUpperCase();

    if (!id || !goalId || !quarter) {
      return NextResponse.json(
        { error: "Missing id, goalId, or quarter" },
        { status: 400 }
      );
    }

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return NextResponse.json(
        { error: "Quarter must be Q1, Q2, Q3, or Q4" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    // Verify access to goal sheet
    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: { employee: { select: { id: true, managerId: true } } },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Goal sheet not found" },
        { status: 404 }
      );
    }

    const isOwn = sheet.employeeId === userId;
    const isManager = role === "MANAGER" && sheet.employee.managerId === userId;
    const isAdmin = role === "ADMIN";

    if (!isOwn && !isManager && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the achievement
    const achievement = await prisma.achievement.findFirst({
      where: { goalId, quarter: quarter as any },
    });

    if (!achievement) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ achievement });
  }
);

// ─── PUT ───────────────────────────────────────────────────────────────────────

export const PUT = withEmployee(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    const goalId = context?.params?.goalId;
    const quarter = context?.params?.quarter?.toUpperCase();

    if (!id || !goalId || !quarter) {
      return NextResponse.json(
        { error: "Missing id, goalId, or quarter" },
        { status: 400 }
      );
    }

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return NextResponse.json(
        { error: "Quarter must be Q1, Q2, Q3, or Q4" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    // Verify access
    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: { employee: { select: { id: true, managerId: true } } },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Goal sheet not found" },
        { status: 404 }
      );
    }

    const isOwn = sheet.employeeId === userId;
    const isManager = role === "MANAGER" && sheet.employee.managerId === userId;
    const isAdmin = role === "ADMIN";

    if (!isOwn && !isManager && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify goal belongs to sheet
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, goalSheetId: id },
      include: { sharedGoalLink: true },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found in this sheet" },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { value } = body as { value?: string };

    if (!value || typeof value !== "string" || value.trim().length === 0) {
      return NextResponse.json(
        { error: "Achievement value is required" },
        { status: 400 }
      );
    }

    // Get the active cycle window for this quarter
    const cycle = await prisma.performanceCycle.findFirst({
      where: {
        organizationId: sheet.organizationId,
        windows: {
          some: { quarter: quarter as any },
        },
      },
      include: {
        windows: {
          where: { quarter: quarter as any },
        },
      },
    });

    if (!cycle || !cycle.windows[0]) {
      return NextResponse.json(
        { error: `No active window found for ${quarter}` },
        { status: 404 }
      );
    }

    const window = cycle.windows[0];
    const now = new Date();

    // Check if window is open
    if (now < window.opensAt || now > window.closesAt) {
      return NextResponse.json(
        { error: `${quarter} window is not open for achievements` },
        { status: 422 }
      );
    }

    // Compute progress score
    let progressScore: number | null = null;
    try {
      progressScore = computeProgressScore(goal.uom, goal.target, value.trim());
    } catch (err) {
      return NextResponse.json(
        { error: `Invalid achievement value for UoM ${goal.uom}` },
        { status: 400 }
      );
    }

    // Upsert achievement
    const achievement = await prisma.achievement.upsert({
      where: {
        goalId_quarter: { goalId, quarter: quarter as any },
      },
      create: {
        goalId,
        quarter: quarter as any,
        value: value.trim(),
        progressScore,
      },
      update: {
        value: value.trim(),
        progressScore,
        updatedAt: new Date(),
      },
    });

    // Propagate to linked shared goals
    if (goal.sharedGoalLink) {
      const sharedGoalId = goal.sharedGoalLink.sharedGoalId;
      const linkedGoals = await prisma.goal.findMany({
        where: {
          sharedGoalId,
          id: { not: goalId },
        },
      });

      // Upsert achievements for all linked goals with same progress score
      await Promise.all(
        linkedGoals.map((linkedGoal) =>
          prisma.achievement.upsert({
            where: {
              goalId_quarter: { goalId: linkedGoal.id, quarter: quarter as any },
            },
            create: {
              goalId: linkedGoal.id,
              quarter: quarter as any,
              value: value.trim(),
              progressScore,
            },
            update: {
              value: value.trim(),
              progressScore,
              updatedAt: new Date(),
            },
          })
        )
      );
    }

    return NextResponse.json({ achievement });
  }
);
