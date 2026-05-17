/**
 * GET /api/v1/analytics/heatmap
 *
 * Returns completion rate matrix (department × quarter).
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

  // Get all departments and goal sheets
  const departments = await prisma.department.findMany({
    include: {
      users: {
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

  // Build heatmap
  const heatmap: Record<
    string,
    { departmentName: string; Q1: number; Q2: number; Q3: number; Q4: number }
  > = {};

  for (const dept of departments) {
    const quarters: Record<string, { total: number; completed: number }> = {
      Q1: { total: 0, completed: 0 },
      Q2: { total: 0, completed: 0 },
      Q3: { total: 0, completed: 0 },
      Q4: { total: 0, completed: 0 },
    };

    for (const user of dept.users) {
      for (const sheet of user.goalSheets) {
        for (const quarter of ["Q1", "Q2", "Q3", "Q4"]) {
          quarters[quarter].total += 1;

          // Check if completed: has achievements and manager review
          const hasAchievements = sheet.goals.some((g) =>
            g.achievements.some((a) => a.quarter === quarter)
          );
          const hasReview = sheet.checkIns.some(
            (c) => c.quarter === quarter && c.status === "MANAGER_REVIEWED"
          );

          if (hasAchievements && hasReview) {
            quarters[quarter].completed += 1;
          }
        }
      }
    }

    heatmap[dept.id] = {
      departmentName: dept.name,
      Q1:
        quarters.Q1.total > 0
          ? Math.round((quarters.Q1.completed / quarters.Q1.total) * 100)
          : 0,
      Q2:
        quarters.Q2.total > 0
          ? Math.round((quarters.Q2.completed / quarters.Q2.total) * 100)
          : 0,
      Q3:
        quarters.Q3.total > 0
          ? Math.round((quarters.Q3.completed / quarters.Q3.total) * 100)
          : 0,
      Q4:
        quarters.Q4.total > 0
          ? Math.round((quarters.Q4.completed / quarters.Q4.total) * 100)
          : 0,
    };
  }

  return NextResponse.json({
    heatmap,
    cycleId: cycle.id,
    cycleName: cycle.name,
  });
});
