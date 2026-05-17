/**
 * DELETE /api/v1/thrust-areas/:id  — delete a thrust area (Admin only)
 *
 * Returns 409 Conflict if any Goal record references this thrust area.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const DELETE = withAdmin(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Missing thrust area id" },
        { status: 400 }
      );
    }

    // Ensure the thrust area exists
    const thrustArea = await prisma.thrustArea.findUnique({ where: { id } });
    if (!thrustArea) {
      return NextResponse.json(
        { error: "Thrust area not found" },
        { status: 404 }
      );
    }

    // Block deletion if any Goal references this thrust area
    const goalCount = await prisma.goal.count({ where: { thrustAreaId: id } });
    if (goalCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete thrust area "${thrustArea.name}" — it is referenced by ${goalCount} goal${goalCount === 1 ? "" : "s"}`,
        },
        { status: 409 }
      );
    }

    await prisma.thrustArea.delete({ where: { id } });

    return NextResponse.json({ success: true });
  }
);
