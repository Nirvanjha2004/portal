/**
 * GET  /api/v1/cycles  — list all performance cycles (Admin only)
 * POST /api/v1/cycles  — create a cycle with 5 default CheckInWindow records (Admin only)
 *
 * BRD default window dates (relative to the cycle's start year):
 *   GOAL_SETTING  opens Apr 1,  closes May 1
 *   Q1            opens Jul 1,  closes Jul 31
 *   Q2            opens Oct 1,  closes Oct 31
 *   Q3            opens Jan 1,  closes Jan 31  (next year)
 *   Q4            opens Mar 1,  closes Apr 15  (next year)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { Quarter } from "@prisma/client";

// ─── Default window builder ───────────────────────────────────────────────────

/**
 * Builds the 5 default CheckInWindow records for a given cycle year.
 * The "year" is derived from the cycle's startDate.
 */
export function buildDefaultWindows(
  cycleId: string,
  startDate: Date
): Array<{
  cycleId: string;
  quarter: Quarter;
  opensAt: Date;
  closesAt: Date;
}> {
  const y = startDate.getFullYear();

  return [
    {
      cycleId,
      quarter: Quarter.GOAL_SETTING,
      opensAt: new Date(`${y}-04-01T00:00:00.000Z`),
      closesAt: new Date(`${y}-05-01T23:59:59.999Z`),
    },
    {
      cycleId,
      quarter: Quarter.Q1,
      opensAt: new Date(`${y}-07-01T00:00:00.000Z`),
      closesAt: new Date(`${y}-07-31T23:59:59.999Z`),
    },
    {
      cycleId,
      quarter: Quarter.Q2,
      opensAt: new Date(`${y}-10-01T00:00:00.000Z`),
      closesAt: new Date(`${y}-10-31T23:59:59.999Z`),
    },
    {
      cycleId,
      quarter: Quarter.Q3,
      opensAt: new Date(`${y + 1}-01-01T00:00:00.000Z`),
      closesAt: new Date(`${y + 1}-01-31T23:59:59.999Z`),
    },
    {
      cycleId,
      quarter: Quarter.Q4,
      opensAt: new Date(`${y + 1}-03-01T00:00:00.000Z`),
      closesAt: new Date(`${y + 1}-04-15T23:59:59.999Z`),
    },
  ];
}

// ─── GET /api/v1/cycles ───────────────────────────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest) => {
  const cycles = await prisma.performanceCycle.findMany({
    orderBy: { startDate: "desc" },
    include: {
      windows: { orderBy: { opensAt: "asc" } },
      _count: { select: { goalSheets: true } },
    },
  });

  return NextResponse.json({ cycles });
});

// ─── POST /api/v1/cycles ──────────────────────────────────────────────────────

export const POST = withAdmin(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, startDate, endDate, isActive } = body as {
    name?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Cycle name is required" },
      { status: 400 }
    );
  }

  if (!startDate || isNaN(Date.parse(startDate))) {
    return NextResponse.json(
      { error: "Valid startDate is required (ISO 8601)" },
      { status: 400 }
    );
  }

  if (!endDate || isNaN(Date.parse(endDate))) {
    return NextResponse.json(
      { error: "Valid endDate is required (ISO 8601)" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    return NextResponse.json(
      { error: "endDate must be after startDate" },
      { status: 400 }
    );
  }

  const activate = isActive === true;

  // ── Transaction: optionally deactivate existing active cycle, create new cycle + windows ──
  const cycle = await prisma.$transaction(async (tx) => {
    if (activate) {
      // Deactivate any currently active cycle
      await tx.performanceCycle.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const newCycle = await tx.performanceCycle.create({
      data: {
        name: name.trim(),
        startDate: start,
        endDate: end,
        isActive: activate,
      },
    });

    // Create 5 default windows
    const windowData = buildDefaultWindows(newCycle.id, start);
    await tx.checkInWindow.createMany({ data: windowData });

    return tx.performanceCycle.findUnique({
      where: { id: newCycle.id },
      include: { windows: { orderBy: { opensAt: "asc" } } },
    });
  });

  return NextResponse.json({ cycle }, { status: 201 });
});
