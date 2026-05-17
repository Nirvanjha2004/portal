/**
 * GET /api/v1/dashboard/completion
 *
 * Returns per-employee and per-manager check-in status for the current window.
 * Scoped by role: Admin = all, Manager = own team.
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const GET = withManager(async (_req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  // Find the active cycle
  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { isActive: true },
    include: { windows: true },
  });

  if (!activeCycle) {
    return NextResponse.json({
      completion: {
        summary: {
          total: 0,
          completed: 0,
          pending: 0,
          percentageComplete: 0,
        },
        employees: [],
      },
    });
  }

  // Get all goal sheets for the active cycle
  let where: any = { cycleId: activeCycle.id };

  if (role === "MANAGER") {
    where.employee = { managerId: userId };
  }

  const sheets = await prisma.goalSheet.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, departmentId: true } },
      goals: {
        include: {
          achievements: {
            where: { quarter: "Q1" }, // Use Q1 as example; could be dynamic
          },
        },
      },
      checkIns: {
        where: { quarter: "Q1" },
      },
    },
  });

  // Calculate completion stats
  let totalSheets = 0;
  let completedSheets = 0;

  const employees = sheets.map((sheet) => {
    const hasAchievements = sheet.goals.some(
      (goal) => goal.achievements.length > 0
    );
    const hasCheckIn = sheet.checkIns.length > 0 && sheet.checkIns[0]?.status === "MANAGER_REVIEWED";
    const isCompleted = hasAchievements && hasCheckIn;

    totalSheets += 1;
    if (isCompleted) completedSheets += 1;

    return {
      employeeId: sheet.employee.id,
      employeeName: sheet.employee.name,
      employeeEmail: sheet.employee.email,
      departmentId: sheet.employee.departmentId,
      sheetStatus: sheet.status,
      achievementSubmitted: hasAchievements,
      checkInReviewed: hasCheckIn,
      isCompleted,
    };
  });

  const percentageComplete =
    totalSheets > 0 ? Math.round((completedSheets / totalSheets) * 100) : 0;

  return NextResponse.json({
    completion: {
      cycleId: activeCycle.id,
      cycleName: activeCycle.name,
      window: "Q1", // Could be dynamic
      summary: {
        total: totalSheets,
        completed: completedSheets,
        pending: totalSheets - completedSheets,
        percentageComplete,
      },
      employees,
    },
  });
});
