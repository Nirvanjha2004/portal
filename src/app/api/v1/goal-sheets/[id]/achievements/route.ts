/**
 * GET /api/v1/goal-sheets/:id/achievements
 *
 * Returns all quarterly achievements for a goal sheet.
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const GET = withEmployee(
  async (
    _req: NextRequest,
    context?: { params: Record<string, string> }
  ) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    // Load the goal sheet
    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, managerId: true } },
        goals: true,
      },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Goal sheet not found" },
        { status: 404 }
      );
    }

    // Check access
    const isOwn = sheet.employeeId === userId;
    const isManager = role === "MANAGER" && sheet.employee.managerId === userId;
    const isAdmin = role === "ADMIN";

    if (!isOwn && !isManager && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all achievements for all goals in the sheet
    const achievements = await prisma.achievement.findMany({
      where: {
        goal: {
          goalSheetId: id,
        },
      },
      include: {
        goal: {
          select: {
            id: true,
            title: true,
            uom: true,
            target: true,
            thrustArea: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ goalId: "asc" }, { quarter: "asc" }],
    });

    return NextResponse.json({ achievements });
  }
);
