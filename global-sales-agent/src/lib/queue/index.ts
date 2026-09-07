/**
 * Queue abstraction: BullMQ + Redis when REDIS_URL is set, otherwise an in-process inline executor
 * (tasks run immediately and are awaited — deterministic for demo & tests).
 */
import type { TaskName, TaskPayloads } from "./handlers";

export const QUEUE_NAME = "gsa-tasks";

type QueueLike = { add: (name: string, data: unknown, opts?: Record<string, unknown>) => Promise<{ id?: string }> };
let bullQueue: QueueLike | null | undefined;

export function queueMode(): "bullmq" | "inline" {
  return process.env.REDIS_URL ? "bullmq" : "inline";
}

async function getBullQueue(): Promise<QueueLike | null> {
  if (bullQueue !== undefined) return bullQueue;
  if (!process.env.REDIS_URL) {
    bullQueue = null;
    return null;
  }
  try {
    const { Queue } = await import("bullmq");
    const { Redis } = await import("ioredis");
    const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    bullQueue = new Queue(QUEUE_NAME, { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 500, removeOnFail: 1000 } }) as unknown as QueueLike;
    return bullQueue;
  } catch (err) {
    console.warn("[queue] BullMQ unavailable, falling back to inline", err);
    bullQueue = null;
    return null;
  }
}

export async function enqueue<N extends TaskName>(name: N, payload: TaskPayloads[N], opts?: { delayMs?: number; jobId?: string }): Promise<{ id: string; mode: "bullmq" | "inline" }> {
  const q = await getBullQueue();
  if (q) {
    const job = await q.add(name, payload, { delay: opts?.delayMs, jobId: opts?.jobId });
    return { id: String(job.id ?? ""), mode: "bullmq" };
  }
  const { runTask } = await import("./handlers");
  if (opts?.delayMs && opts.delayMs > 0) {
    setTimeout(() => runTask(name, payload).catch((e) => console.error(`[inline-queue] ${name} failed`, e)), opts.delayMs);
    return { id: `inline-delayed-${Date.now()}`, mode: "inline" };
  }
  await runTask(name, payload);
  return { id: `inline-${Date.now()}`, mode: "inline" };
}
