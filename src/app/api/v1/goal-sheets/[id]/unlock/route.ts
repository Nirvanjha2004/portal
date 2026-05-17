/**
 * POST /api/v1/goal-sheets/:id/unlock
 *
 * Admin only. Unlocks an APPROVED sheet back to DRAFT.
 * Clears lockDate. Writes an AuditLog entry with the reason.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const POST = withAdmin(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing sheet id" }, { status: 400 });
    }

    const session = await auth();
    const actorId = session!.user.id;

    const sheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: { goals: true },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Goal sheet not found" }, { status: 404 });
    }

    if (sheet.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Cannot unlock a sheet with status "${sheet.status}". Only APPROVED sheets can be unlocked.` },
        { status: 422 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { reason } = body as { reason?: string };

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "A reason is required when unlocking a sheet" },
        { status: 400 }
      );
    }

    // Write AuditLog entries for each goal (unlock event)
    const auditEntries = sheet.goals.map((goal) => ({
      actorId,
      goalId: goal.id,
      field: "status",
      oldValue: "APPROVED",
      newValue: "DRAFT",
      reason: reason.trim(),
    }));

    const [updated] = await prisma.$transaction([
      prisma.goalSheet.update({
        where: { id },
        data: {
          status: "DRAFT",
          lockDate: null,
        },
        include: {
          cycle: { select: { id: true, name: true, isActive: true } },
          goals: { include: { thrustArea: { select: { id: true, name: true } } } },
        },
      }),
      ...(auditEntries.length > 0
        ? [prisma.auditLog.createMany({ data: auditEntries })]
        : []),
    ]);

    return NextResponse.json({ goalSheet: updated });
  }
);
