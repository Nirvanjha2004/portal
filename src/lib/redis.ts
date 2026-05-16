/**
 * Redis client singleton using ioredis.
 * Re-uses the same connection across hot-reloads in development.
 */
import Redis from "ioredis";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] connection error:", err);
  });

  return client;
}

const redis: Redis =
  process.env.NODE_ENV === "production"
    ? createRedisClient()
    : (globalThis.__redis ?? (globalThis.__redis = createRedisClient()));

export default redis;
