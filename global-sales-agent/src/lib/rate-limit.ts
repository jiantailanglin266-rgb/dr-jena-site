/** Token bucket rate limiter. Uses Redis when REDIS_URL is set, otherwise in-memory. */
const memory = new Map<string, { count: number; resetAt: number }>();

let redisClient: import("ioredis").Redis | null | undefined;

async function getRedis() {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    const { Redis } = await import("ioredis");
    redisClient = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, enableOfflineQueue: false });
    await redisClient.connect().catch(() => {});
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; remaining: number }> {
  const redis = await getRedis();
  if (redis && redis.status === "ready") {
    try {
      const k = `rl:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, windowSec);
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
    } catch {
      // fall through to memory
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    if (memory.size > 10000) {
      for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
    }
    return { allowed: true, remaining: limit - 1 };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}
