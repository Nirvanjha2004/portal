/**
 * GET /api/v1/analytics/manager-effectiveness
 *
 * Returns per-manager metrics:
 * - Direct report count
 * - Average team progress score
 * - Check-in completion rate
 * - Average days to approve
 *
 * Query parameters:
 *   - cycleId: cycle ID (optional; defaults to active cycle)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withAdmin(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const cycleId = searchParams.get("cycleId");

  // Determine cycle to use
  let cycle;
  if (cycleId) {
    cycle = await prisma.performanceCycle.findUnique({ where: { id: cycleId } });
  } else {
    cycle = await prisma.performanceCycle.findFirst({
      where: { isActive: true },
    });
  }

  if (!cycle) {
    return NextResponse.json(
      { error: "Cycle not found" },
      { status: 404 }
    );
  }

  // Get all managers with their direct reports
  const managers = await prisma.user.findMany({
    where: { role: "MANAGER" },
    include: {
      reports: {
        include: {
          goalSheets: {
            where: { cycleId: cycle.id },
            include: {
              goals: {
                include: {
                  achievements: true,
                },
              },
              checkIns: true,
            },
          },
        },
      },
    },
  });

  const effectiveness = managers.map((manager) => {
    let totalProgressScore = 0;
    let scoreCount = 0;
    let completedCheckIns = 0;
    let totalCheckIns = 0;
    let totalDaysToApprove = 0;
    let approvalsCount = 0;

    for (const employee of manager.reports) {
      for (const sheet of employee.goalSheets) {
        // Calculate team progress score
        for (const goal of sheet.goals) {
          for (const achievement of goal.achievements) {
            if (achievement.progressScore !== null) {
              totalProgressScore += achievement.progressScore;
              scoreCount += 1;
            }
          }
        }

        // Check-in completion
        for (const checkIn of sheet.checkIns) {
          totalCheckIns += 1;
          if (checkIn.status === "MANAGER_REVIEWED") {
            completedCheckIns += 1;
          }

          // Days to approve
          if (
            sheet.status === "APPROVED" &&
            sheet.submittedAt &&
            checkIn.reviewedAt
          ) {
            const daysToReview = Math.round(
              (checkIn.reviewedAt.getTime() - sheet.submittedAt.getTime()) /
                (1000 * 60 * 60 * 24)
            );
            totalDaysToApprove += daysToReview;
            approvalsCount += 1;
          }
        }
      }
    }

    return {
      managerId: manager.id,
      managerName: manager.name,
      directReportCount: manager.reports.length,
      averageTeamProgressScore:
        scoreCount > 0
          ? Math.round((totalProgressScore / scoreCount) * 100) / 100
          : null,
      checkInCompletionRate:
        totalCheckIns > 0
          ? Math.round((completedCheckIns / totalCheckIns) * 100)
          : 0,
      averageDaysToApprove:
        approvalsCount > 0
          ? Math.round((totalDaysToApprove / approvalsCount) * 100) / 100
          : null,
    };
  });

  return NextResponse.json({
    effectiveness,
    cycleId: cycle.id,
    cycleName: cycle.name,
  });
});
