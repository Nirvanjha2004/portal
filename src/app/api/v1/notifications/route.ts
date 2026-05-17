/**
 * GET /api/v1/notifications  — paginated list of notifications for current user
 * PUT /api/v1/notifications/read-all  — mark all notifications as read
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const GET = withEmployee(async (req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;

  const searchParams = req.nextUrl.searchParams;
  const pageStr = searchParams.get("page") || "1";
  const limitStr = searchParams.get("limit") || "20";

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20));
  const skip = (page - 1) * limit;

  // Get total count
  const total = await prisma.notification.count({
    where: { recipientId: userId },
  });

  // Get paginated notifications
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  return NextResponse.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const PUT = withEmployee(async (req: NextRequest) => {
  const session = await auth();
  const userId = session!.user.id;

  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "read-all") {
    // Mark all notifications as read
    await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ message: "All notifications marked as read" });
  }

  return NextResponse.json(
    { error: "Unknown action" },
    { status: 400 }
  );
});
