/**
 * GET  /api/v1/checkins  — returns manager's direct reports' goal sheets with achievements in current quarter
 * POST /api/v1/checkins  — (reserved for future use, not in scope for Task 13)
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveWindow } from "@/lib/cycle-helpers";

export const GET = withManager(async (_req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  // Find the active cycle and current quarter window
  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { isActive: true },
    include: { windows: true },
  });

  if (!activeCycle) {
    return NextResponse.json({
      checkins: [],
      message: "No active performance cycle",
    });
  }

  // For now, we'll get the first available window (usually GOAL_SETTING or Q1, etc.)
  // In a real system, you might want the "current" quarter
  const currentWindow = activeCycle.windows[0]; // Could be dynamic based on date

  if (!currentWindow) {
    return NextResponse.json({
      checkins: [],
      message: "No check-in window found",
    });
  }

  // Get direct reports for this manager (or all employees if admin)
  let where: any = {
    cycle: { isActive: true },
  };

  if (role === "MANAGER") {
    where = {
      ...where,
      employee: {
        managerId: userId,
      },
    };
  }

  // Get goal sheets with achievements in the current quarter
  const sheets = await prisma.goalSheet.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      goals: {
        include: {
          achievements: {
            where: { quarter: currentWindow.quarter },
          },
        },
      },
      checkIns: {
        where: { quarter: currentWindow.quarter },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter to only sheets that have at least one achievement in this quarter
  const sheetsWithAchievements = sheets.filter((sheet) => {
    const hasAchievements = sheet.goals.some(
      (goal) => goal.achievements.length > 0
    );
    return hasAchievements;
  });

  return NextResponse.json({
    checkins: sheetsWithAchievements.map((sheet) => ({
      id: sheet.id,
      employeeId: sheet.employeeId,
      employeeName: sheet.employee.name,
      employeeEmail: sheet.employee.email,
      cycleId: sheet.cycleId,
      quarter: currentWindow.quarter,
      status: sheet.checkIns[0]?.status || "PENDING",
      goalsCount: sheet.goals.length,
      achievementsCount: sheet.goals.reduce(
        (sum, g) => sum + g.achievements.length,
        0
      ),
    })),
    window: { quarter: currentWindow.quarter, opensAt: currentWindow.opensAt, closesAt: currentWindow.closesAt },
  });
});
