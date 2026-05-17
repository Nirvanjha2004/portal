/**
 * GET /api/v1/escalation-logs — returns escalation logs (Admin only)
 *
 * Query parameters:
 *   - ruleId: filter by escalation rule ID
 *   - from: start date (ISO string)
 *   - to: end date (ISO string)
 *   - page: page number (default 1)
 *   - limit: results per page (default 50, max 100)
 */
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export const GET = withAdmin(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;

  const ruleId = searchParams.get("ruleId") || undefined;
  const fromStr = searchParams.get("from") || undefined;
  const toStr = searchParams.get("to") || undefined;
  const pageStr = searchParams.get("page") || "1";
  const limitStr = searchParams.get("limit") || "50";

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 50));
  const skip = (page - 1) * limit;

  // Build where clause
  let where: any = {};

  if (ruleId) {
    where.ruleId = ruleId;
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
  const total = await prisma.escalationLog.count({ where });

  // Get paginated logs
  const logs = await prisma.escalationLog.findMany({
    where,
    include: {
      rule: { select: { id: true, eventType: true, daysOverdue: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
