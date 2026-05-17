/**
 * GET  /api/v1/escalation-rules  — list escalation rules (Admin only)
 * POST /api/v1/escalation-rules  — create escalation rule (Admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import type { EscalationType, Role } from "@prisma/client";

export const GET = withAdmin(async (_req: NextRequest) => {
  const rules = await prisma.escalationRule.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rules });
});

export const POST = withAdmin(async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    eventType,
    daysOverdue,
    recipientUserId,
    recipientRole,
    isActive = true,
  } = body as {
    eventType?: string;
    daysOverdue?: number;
    recipientUserId?: string;
    recipientRole?: string;
    isActive?: boolean;
  };

  // Validate required fields
  if (!eventType || typeof eventType !== "string") {
    return NextResponse.json(
      { error: "eventType is required" },
      { status: 400 }
    );
  }

  if (
    daysOverdue === undefined ||
    typeof daysOverdue !== "number" ||
    daysOverdue < 0
  ) {
    return NextResponse.json(
      { error: "daysOverdue must be a non-negative number" },
      { status: 400 }
    );
  }

  // Create the rule
  const rule = await prisma.escalationRule.create({
    data: {
      eventType: eventType as EscalationType,
      daysOverdue,
      recipientUserId: recipientUserId || null,
      recipientRole: (recipientRole || null) as Role | null,
      isActive,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
});
