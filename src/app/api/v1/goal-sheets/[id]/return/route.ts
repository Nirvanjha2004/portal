/**
 * POST /api/v1/goal-sheets/:id/return
 *
 * Manager returns a PENDING_APPROVAL sheet for rework.
 * Sets status → RETURNED, records reworkComment.
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const POST = withManager(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing sheet id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;
    const role = session!.user.role;

    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: { employee: { select: { id: true, managerId: true } } },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    }

    // Manager must own the employee (or be Admin)
    if (role === "MANAGER" && sheet.employee.managerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (sheet.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: `Cannot return a sheet with status "${sheet.status}"` },
        { status: 422 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { comment } = body as { comment?: string };

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      return NextResponse.json(
        { error: "A rework comment is required when returning a sheet" },
        { status: 400 }
      );
    }

    if (comment.trim().length > 2000) {
      return NextResponse.json(
        { error: "Rework comment must not exceed 2000 characters" },
        { status: 400 }
      );
    }

    const updated = await prisma.goalSheet.update({
      where: { id },
      data: {
        status: "RETURNED",
        reworkComment: comment.trim(),
      },
      include: {
        cycle: { select: { id: true, name: true, isActive: true } },
        goals: { include: { thrustArea: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ goalSheet: updated });
  }
);
