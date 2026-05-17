/**
 * Notification Service
 *
 * Handles in-portal notifications via database and Redis pub/sub.
 * Publishes notifications to Redis channels for real-time delivery.
 */
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import type { NotificationType } from "@prisma/client";

export interface NotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  deepLink?: string;
}

/**
 * Dispatch a notification to a user.
 *
 * Creates a database record and publishes to Redis channel.
 */
export async function dispatch(
  recipientId: string,
  type: NotificationType,
  payload: Omit<NotificationPayload, "type">
): Promise<void> {
  // Create notification in database
  const notification = await prisma.notification.create({
    data: {
      recipientId,
      type,
      title: payload.title,
      body: payload.body,
      deepLink: payload.deepLink,
    },
  });

  // Publish to Redis channel for SSE
  const channel = `notifications:${recipientId}`;
  await redis.publish(
    channel,
    JSON.stringify({
      id: notification.id,
      type,
      title: payload.title,
      body: payload.body,
      deepLink: payload.deepLink,
      createdAt: notification.createdAt,
    })
  );
}

/**
 * Dispatch notifications to multiple users.
 */
export async function dispatchBatch(
  recipientIds: string[],
  type: NotificationType,
  payload: Omit<NotificationPayload, "type">
): Promise<void> {
  for (const recipientId of recipientIds) {
    await dispatch(recipientId, type, payload);
  }
}
