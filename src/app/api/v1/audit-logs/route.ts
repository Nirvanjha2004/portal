/**
 * GET /api/v1/audit-logs — returns paginated audit log entries with optional filters
 *
 * Query parameters:
 *   - employeeId: filter by employee ID
 *   - goalSheetId: filter by goal sheet ID
 *   - actorId: filter by actor (user who made the change)
 *   - from: start date (ISO string)
 *   - to: end date (ISO string)
 *   - page: page number (default 1)
 *   - limit: results per page (default 100, max 100)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withAdmin(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;

  // Parse query parameters
  const employeeId = searchParams.get("employeeId") || undefined;
  const goalSheetId = searchParams.get("goalSheetId") || undefined;
  const actorId = searchParams.get("actorId") || undefined;
  const fromStr = searchParams.get("from") || undefined;
  const toStr = searchParams.get("to") || undefined;
  const pageStr = searchParams.get("page") || "1";
  const limitStr = searchParams.get("limit") || "100";

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 100));
  const skip = (page - 1) * limit;

  // Build where clause
  let where: any = {};

  if (goalSheetId) {
    where.goal = { goalSheetId };
  }

  if (employeeId) {
    where.goal = {
      ...where.goal,
      goalSheet: { employeeId },
    };
  }

  if (actorId) {
    where.actorId = actorId;
  }

  if (fromStr || toStr) {
    where.createdAt = {};
    if (fromStr) {
      const from = new Date(fromStr);
      if (!isNaN(from.getTime())) {
        where.createdAt.gte = from;
      }
    }
    if (toStr) {
      const to = new Date(toStr);
      if (!isNaN(to.getTime())) {
        where.createdAt.lte = to;
      }
    }
  }

  // Get total count
  const total = await prisma.auditLog.count({ where });

  // Get paginated results
  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      goal: {
        include: {
          goalSheet: {
            include: {
              employee: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      actorId: log.actor.id,
      actorName: log.actor.name,
      actorEmail: log.actor.email,
      goalId: log.goal.id,
      goalTitle: log.goal.title,
      employeeId: log.goal.goalSheet.employee.id,
      employeeName: log.goal.goalSheet.employee.name,
      goalSheetId: log.goal.goalSheetId,
      field: log.field,
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason,
      timestamp: log.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
