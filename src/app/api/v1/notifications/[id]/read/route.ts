/**
 * PUT /api/v1/notifications/:id/read — mark a notification as read
 */
import { NextRequest, NextResponse } from "next/server";
import { withEmployee } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const PUT = withEmployee(
  async (
    _req: NextRequest,
    context?: { params: Record<string, string> }
  ) => {
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const session = await auth();
    const userId = session!.user.id;

    // Verify the notification belongs to the user
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.recipientId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark as read
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ notification: updated });
  }
);
