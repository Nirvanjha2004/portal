/**
 * GET /api/v1/notifications/stream — SSE stream for real-time notifications
 *
 * Subscribes to the user's Redis notification channel and streams events.
 * Keeps the connection open for event streaming.
 */
import { auth } from "@/lib/auth";
import redis from "@/lib/redis";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const channel = `notifications:${userId}`;

  // Create a ReadableStream for SSE
  const readable = new ReadableStream({
    async start(controller) {
      // Create a subscriber
      const subscriber = redis.duplicate();

      try {
        // Subscribe to the user's notification channel
        await subscriber.subscribe(channel, (message) => {
          // Send the message as an SSE event
          const data = `data: ${message}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        });

        // Handle unsubscribe on client disconnect
        request.signal.addEventListener("abort", async () => {
          await subscriber.unsubscribe(channel);
          await subscriber.quit();
          controller.close();
        });
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
