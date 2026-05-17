/**
 * GET /api/v1/cycles/:id  — get a single cycle (Admin only)
 * PUT /api/v1/cycles/:id  — update a cycle; activating it deactivates all others (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

// ─── GET /api/v1/cycles/:id ───────────────────────────────────────────────────

export const GET = withAdmin(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing cycle id" }, { status: 400 });
    }

    const cycle = await prisma.performanceCycle.findUnique({
      where: { id },
      include: {
        windows: { orderBy: { opensAt: "asc" } },
        _count: { select: { goalSheets: true } },
      },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    return NextResponse.json({ cycle });
  }
);

// ─── PUT /api/v1/cycles/:id ───────────────────────────────────────────────────

export const PUT = withAdmin(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing cycle id" }, { status: 400 });
    }

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

    // Ensure the cycle exists
    const existing = await prisma.performanceCycle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Build update data
    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Cycle name must be a non-empty string" },
          { status: 400 }
        );
      }
      data.name = name.trim();
    }

    if (startDate !== undefined) {
      if (isNaN(Date.parse(startDate))) {
        return NextResponse.json(
          { error: "Valid startDate is required (ISO 8601)" },
          { status: 400 }
        );
      }
      data.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      if (isNaN(Date.parse(endDate))) {
        return NextResponse.json(
          { error: "Valid endDate is required (ISO 8601)" },
          { status: 400 }
        );
      }
      data.endDate = new Date(endDate);
    }

    // Validate start < end after merging with existing values
    const resolvedStart = (data.startDate as Date | undefined) ?? existing.startDate;
    const resolvedEnd = (data.endDate as Date | undefined) ?? existing.endDate;
    if (resolvedEnd <= resolvedStart) {
      return NextResponse.json(
        { error: "endDate must be after startDate" },
        { status: 400 }
      );
    }

    if (isActive !== undefined) {
      data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    // If activating this cycle, deactivate all others in a transaction
    const cycle = await prisma.$transaction(async (tx) => {
      if (data.isActive === true) {
        await tx.performanceCycle.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }

      return tx.performanceCycle.update({
        where: { id },
        data,
        include: { windows: { orderBy: { opensAt: "asc" } } },
      });
    });

    return NextResponse.json({ cycle });
  }
);
