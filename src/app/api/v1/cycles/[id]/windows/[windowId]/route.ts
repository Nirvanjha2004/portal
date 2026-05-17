/**
 * PUT /api/v1/cycles/:id/windows/:windowId  — update a check-in window's open/close dates (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const PUT = withAdmin(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const cycleId = context?.params?.id;
    const windowId = context?.params?.windowId;

    if (!cycleId) {
      return NextResponse.json({ error: "Missing cycle id" }, { status: 400 });
    }
    if (!windowId) {
      return NextResponse.json({ error: "Missing window id" }, { status: 400 });
    }

    // Verify the cycle exists
    const cycle = await prisma.performanceCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Verify the window exists and belongs to this cycle
    const existing = await prisma.checkInWindow.findFirst({
      where: { id: windowId, cycleId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Window not found for this cycle" },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { opensAt, closesAt } = body as {
      opensAt?: string;
      closesAt?: string;
    };

    const data: Record<string, Date> = {};

    if (opensAt !== undefined) {
      if (isNaN(Date.parse(opensAt))) {
        return NextResponse.json(
          { error: "Valid opensAt is required (ISO 8601)" },
          { status: 400 }
        );
      }
      data.opensAt = new Date(opensAt);
    }

    if (closesAt !== undefined) {
      if (isNaN(Date.parse(closesAt))) {
        return NextResponse.json(
          { error: "Valid closesAt is required (ISO 8601)" },
          { status: 400 }
        );
      }
      data.closesAt = new Date(closesAt);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided (opensAt or closesAt)" },
        { status: 400 }
      );
    }

    // Validate opensAt < closesAt after merging with existing values
    const resolvedOpens = data.opensAt ?? existing.opensAt;
    const resolvedCloses = data.closesAt ?? existing.closesAt;
    if (resolvedCloses <= resolvedOpens) {
      return NextResponse.json(
        { error: "closesAt must be after opensAt" },
        { status: 400 }
      );
    }

    const window = await prisma.checkInWindow.update({
      where: { id: windowId },
      data,
    });

    return NextResponse.json({ window });
  }
);
