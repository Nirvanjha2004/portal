/**
 * GET /api/v1/cycles/:id/windows  — list all check-in windows for a cycle (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withAdmin(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing cycle id" }, { status: 400 });
    }

    const cycle = await prisma.performanceCycle.findUnique({ where: { id } });
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    const windows = await prisma.checkInWindow.findMany({
      where: { cycleId: id },
      orderBy: { opensAt: "asc" },
    });

    return NextResponse.json({ windows });
  }
);
