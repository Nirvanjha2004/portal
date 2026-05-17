/**
 * PUT    /api/v1/escalation-rules/:id  — update escalation rule (Admin only)
 * DELETE /api/v1/escalation-rules/:id  — delete escalation rule (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const PUT = withAdmin(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { daysOverdue, recipientUserId, recipientRole, isActive } = body as {
      daysOverdue?: number;
      recipientUserId?: string;
      recipientRole?: string;
      isActive?: boolean;
    };

    // Build update data
    const data: Record<string, any> = {};

    if (daysOverdue !== undefined) {
      if (typeof daysOverdue !== "number" || daysOverdue < 0) {
        return NextResponse.json(
          { error: "daysOverdue must be a non-negative number" },
          { status: 400 }
        );
      }
      data.daysOverdue = daysOverdue;
    }

    if (recipientUserId !== undefined) {
      data.recipientUserId = recipientUserId || null;
    }

    if (recipientRole !== undefined) {
      data.recipientRole = (recipientRole || null) as Role | null;
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

    const rule = await prisma.escalationRule.update({
      where: { id },
      data,
    });

    return NextResponse.json({ rule });
  }
);

export const DELETE = withAdmin(
  async (_req: NextRequest, context?: { params: Record<string, string> }) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const rule = await prisma.escalationRule.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Rule deleted", rule });
  }
);
