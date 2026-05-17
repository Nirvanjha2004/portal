/**
 * GET /api/v1/shared-goals/:id — retrieve a shared goal with its linked goals
 */
import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withManager(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const sharedGoal = await prisma.sharedGoal.findUnique({
      where: { id },
      include: {
        linkedGoals: {
          include: {
            goalSheet: {
              include: {
                employee: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!sharedGoal) {
      return NextResponse.json(
        { error: "Shared goal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ sharedGoal });
  }
);
