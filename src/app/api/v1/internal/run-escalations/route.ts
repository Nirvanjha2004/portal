/**
 * POST /api/v1/internal/run-escalations
 *
 * Internal endpoint (protected by INTERNAL_SECRET header) that checks overdue conditions
 * for each active escalation rule and dispatches notifications.
 *
 * Protected by INTERNAL_SECRET environment variable.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { dispatch } from "@/services/notification.service";

export const POST = async (req: NextRequest) => {
  // Verify internal secret
  const secret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active escalation rules
  const rules = await prisma.escalationRule.findMany({
    where: { isActive: true },
  });

  let escalationsTriggered = 0;

  for (const rule of rules) {
    // Determine the condition to check based on event type
    let sheetWhere: any = { cycle: { isActive: true } };

    switch (rule.eventType) {
      case "OVERDUE_SUBMISSION": {
        // Goal sheets that haven't been submitted beyond the deadline
        // We'll check if the GOAL_SETTING window closed > daysOverdue ago
        const cutoffDate = new Date(
          Date.now() - rule.daysOverdue * 24 * 60 * 60 * 1000
        );
        sheetWhere = {
          ...sheetWhere,
          status: "DRAFT",
          createdAt: { lt: cutoffDate },
        };
        break;
      }

      case "OVERDUE_APPROVAL": {
        // Goal sheets pending approval for > daysOverdue days
        const cutoffDate = new Date(
          Date.now() - rule.daysOverdue * 24 * 60 * 60 * 1000
        );
        sheetWhere = {
          ...sheetWhere,
          status: "PENDING_APPROVAL",
          submittedAt: { lt: cutoffDate },
        };
        break;
      }

      case "OVERDUE_CHECKIN": {
        // Goal sheets without check-in review for > daysOverdue days
        // This is more complex, skip for now
        continue;
      }
    }

    // Find sheets matching the condition
    const sheets = await prisma.goalSheet.findMany({
      where: sheetWhere,
      include: {
        employee: { select: { id: true, name: true, managerId: true } },
        cycle: { select: { name: true } },
      },
    });

    // Check for already-logged escalations (duplicate prevention)
    const recentLogs = await prisma.escalationLog.findMany({
      where: {
        ruleId: rule.id,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
        },
      },
    });

    const loggedSheetIds = new Set(recentLogs.map((log) => log.goalSheetId));

    // Process each sheet
    for (const sheet of sheets) {
      if (loggedSheetIds.has(sheet.id)) {
        // Already escalated recently, skip
        continue;
      }

      // Determine recipient(s)
      let recipientIds: string[] = [];

      if (rule.recipientUserId) {
        recipientIds = [rule.recipientUserId];
      } else if (rule.recipientRole === "MANAGER" && sheet.employee.managerId) {
        recipientIds = [sheet.employee.managerId];
      } else if (rule.recipientRole === "ADMIN") {
        // Get all admins (for now, just log)
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        recipientIds = admins.map((a) => a.id);
      }

      // Dispatch notification
      const eventLabel = rule.eventType
        .toLowerCase()
        .replace(/_/g, " ");

      for (const recipientId of recipientIds) {
        await dispatch(recipientId, "ESCALATION", {
          title: `Escalation: ${eventLabel}`,
          body: `${sheet.employee.name}'s goal sheet for ${sheet.cycle.name} requires attention.`,
          deepLink: `/goals/${sheet.id}`,
        });
      }

      // Log the escalation
      await prisma.escalationLog.create({
        data: {
          ruleId: rule.id,
          goalSheetId: sheet.id,
        },
      });

      escalationsTriggered += recipientIds.length;
    }
  }

  return NextResponse.json({
    message: "Escalations processed",
    escalationsTriggered,
    timestamp: new Date(),
  });
};
