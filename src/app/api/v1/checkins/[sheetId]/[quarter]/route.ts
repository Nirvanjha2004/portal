/**
 * GET /api/v1/checkins/:sheetId/:quarter  — returns full check-in detail for a goal sheet quarter
 * PUT /api/v1/checkins/:sheetId/:quarter  — saves manager comment and sets status to MANAGER_REVIEWED
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ─── GET /api/v1/checkins/:sheetId/:quarter ───────────────────────────────────

export const GET = withManager(
  async (
    _req: NextRequest,
    context?: { params: Record<string, string> }
  ) => {
    const sheetId = context?.params?.sheetId;
    const quarter = context?.params?.quarter;

    if (!sheetId || !quarter) {
      return NextResponse.json(
        { error: "Missing sheetId or quarter" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    // Load the goal sheet
    const sheet = await prisma.goalSheet.findUnique({
      where: { id: sheetId },
      include: {
        employee: { select: { id: true, name: true, email: true, managerId: true } },
        cycle: { select: { id: true, name: true } },
        goals: {
          include: {
            thrustArea: { select: { id: true, name: true } },
            achievements: {
              where: { quarter: quarter as any },
            },
          },
        },
        checkIns: {
          where: { quarter: quarter as any },
        },
      },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Goal sheet not found" },
        { status: 404 }
      );
    }

    // Manager can only access their direct reports' sheets
    if (role === "MANAGER" && sheet.employee.managerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const checkIn = sheet.checkIns[0] || null;

    return NextResponse.json({
      checkin: {
        sheetId: sheet.id,
        employeeId: sheet.employeeId,
        employeeName: sheet.employee.name,
        cycleId: sheet.cycleId,
        quarter,
        status: checkIn?.status || "PENDING",
        comment: checkIn?.comment || null,
        managerId: checkIn?.managerId || null,
        reviewedAt: checkIn?.reviewedAt || null,
        goals: sheet.goals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          description: goal.description,
          thrustArea: goal.thrustArea.name,
          uom: goal.uom,
          target: goal.target,
          weightage: goal.weightage,
          achievement: goal.achievements[0]?.achievement || null,
          status: goal.achievements[0]?.status || "NOT_STARTED",
          progressScore: goal.achievements[0]?.progressScore || null,
        })),
      },
    });
  }
);

// ─── PUT /api/v1/checkins/:sheetId/:quarter ────────────────────────────────────

export const PUT = withManager(
  async (
    req: NextRequest,
    context?: { params: Record<string, string> }
  ) => {
    const sheetId = context?.params?.sheetId;
    const quarter = context?.params?.quarter;

    if (!sheetId || !quarter) {
      return NextResponse.json(
        { error: "Missing sheetId or quarter" },
        { status: 400 }
      );
    }

    const session = await auth();
    const managerId = session!.user.id;
    const role = session!.user.role;

    // Load the goal sheet
    const sheet = await prisma.goalSheet.findUnique({
      where: { id: sheetId },
      include: {
        employee: { select: { id: true, managerId: true } },
        goals: {
          include: {
            achievements: {
              where: { quarter: quarter as any },
            },
          },
        },
      },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Goal sheet not found" },
        { status: 404 }
      );
    }

    // Manager can only check in their direct reports' sheets
    if (role === "MANAGER" && sheet.employee.managerId !== managerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if employee has submitted achievements for this quarter
    const hasAchievements = sheet.goals.some(
      (goal) => goal.achievements.length > 0
    );

    if (!hasAchievements) {
      return NextResponse.json(
        {
          error: `Employee has not yet submitted achievements for ${quarter}`,
        },
        { status: 422 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { comment } = body as { comment?: string };

    if (!comment || typeof comment !== "string") {
      return NextResponse.json(
        { error: "comment is required" },
        { status: 400 }
      );
    }

    if (comment.trim().length > 2000) {
      return NextResponse.json(
        { error: "comment must not exceed 2000 characters" },
        { status: 400 }
      );
    }

    // Upsert the check-in
    const checkIn = await prisma.checkIn.upsert({
      where: {
        goalSheetId_quarter: {
          goalSheetId: sheetId,
          quarter: quarter as any,
        },
      },
      create: {
        goalSheetId: sheetId,
        quarter: quarter as any,
        managerId,
        comment: comment.trim(),
        status: "MANAGER_REVIEWED",
        reviewedAt: new Date(),
      },
      update: {
        managerId,
        comment: comment.trim(),
        status: "MANAGER_REVIEWED",
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ checkIn });
  }
);
