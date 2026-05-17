/**
 * GET /api/v1/analytics/trends
 *
 * Returns QoQ average progress scores per employee, team, and department.
 *
 * Query parameters:
 *   - cycleId: cycle ID (optional; defaults to active cycle)
 *   - departmentId: filter by department ID (optional)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withAdmin(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const cycleId = searchParams.get("cycleId");
  const departmentId = searchParams.get("departmentId");

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

  // Get all goal sheets with achievements for this cycle
  let where: any = { cycleId: cycle.id };
  if (departmentId) {
    where.employee = { departmentId };
  }

  const sheets = await prisma.goalSheet.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      },
      goals: {
        include: {
          achievements: true,
        },
      },
    },
  });

  // Calculate average progress scores by employee and quarter
  const employeeTrends: Record<
    string,
    { name: string; departmentId?: string; Q1: number; Q2: number; Q3: number; Q4: number; count: Record<string, number> }
  > = {};

  for (const sheet of sheets) {
    const empId = sheet.employee.id;
    if (!employeeTrends[empId]) {
      employeeTrends[empId] = {
        name: sheet.employee.name,
        departmentId: sheet.employee.departmentId || undefined,
        Q1: 0,
        Q2: 0,
        Q3: 0,
        Q4: 0,
        count: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
      };
    }

    for (const goal of sheet.goals) {
      for (const achievement of goal.achievements) {
        const quarter = achievement.quarter;
        if (["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
          const score = achievement.progressScore || 0;
          employeeTrends[empId][quarter] += score;
          employeeTrends[empId].count[quarter] += 1;
        }
      }
    }
  }

  // Compute averages
  const trends = Object.entries(employeeTrends).map(([empId, data]) => ({
    employeeId: empId,
    name: data.name,
    departmentId: data.departmentId,
    Q1: data.count.Q1 > 0 ? Math.round((data.Q1 / data.count.Q1) * 100) / 100 : null,
    Q2: data.count.Q2 > 0 ? Math.round((data.Q2 / data.count.Q2) * 100) / 100 : null,
    Q3: data.count.Q3 > 0 ? Math.round((data.Q3 / data.count.Q3) * 100) / 100 : null,
    Q4: data.count.Q4 > 0 ? Math.round((data.Q4 / data.count.Q4) * 100) / 100 : null,
  }));

  return NextResponse.json({
    trends,
    cycleId: cycle.id,
    cycleName: cycle.name,
  });
});
