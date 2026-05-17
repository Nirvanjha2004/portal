/**
 * GET /api/v1/analytics/distribution
 *
 * Returns goal counts and percentages by ThrustArea and UoM.
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

  // Get all goals in this cycle
  const goals = await prisma.goal.findMany({
    where: {
      goalSheet: { cycleId: cycle.id },
    },
    include: {
      thrustArea: { select: { id: true, name: true } },
    },
  });

  // Count by thrust area
  const byThrustArea: Record<
    string,
    { name: string; count: number }
  > = {};
  const byUoM: Record<
    string,
    { count: number }
  > = {};

  let totalGoals = goals.length;

  for (const goal of goals) {
    // By thrust area
    const taId = goal.thrustArea.id;
    if (!byThrustArea[taId]) {
      byThrustArea[taId] = { name: goal.thrustArea.name, count: 0 };
    }
    byThrustArea[taId].count += 1;

    // By UoM
    if (!byUoM[goal.uom]) {
      byUoM[goal.uom] = { count: 0 };
    }
    byUoM[goal.uom].count += 1;
  }

  // Convert to arrays with percentages
  const thrustAreas = Object.entries(byThrustArea).map(([id, data]) => ({
    id,
    name: data.name,
    count: data.count,
    percentage:
      totalGoals > 0
        ? Math.round((data.count / totalGoals) * 100 * 100) / 100
        : 0,
  }));

  const uoms = Object.entries(byUoM).map(([uom, data]) => ({
    uom,
    count: data.count,
    percentage:
      totalGoals > 0
        ? Math.round((data.count / totalGoals) * 100 * 100) / 100
        : 0,
  }));

  return NextResponse.json({
    distribution: {
      byThrustArea: thrustAreas,
      byUoM: uoms,
    },
    totalGoals,
    cycleId: cycle.id,
    cycleName: cycle.name,
  });
});
