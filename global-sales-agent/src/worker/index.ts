/**
 * Worker process: BullMQ consumer (when REDIS_URL) + scheduler (discovery / reply polling / scheduled sends).
 * Run: npm run worker
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { runTask, type TaskName, type TaskPayloads } from "../lib/queue/handlers";
import { QUEUE_NAME } from "../lib/queue";
import { flushScheduled } from "../lib/sending/send-engine";

const DISCOVERY_MIN = Number(process.env.DISCOVERY_INTERVAL_MINUTES ?? 30);
const REPLY_MIN = Number(process.env.REPLY_POLL_INTERVAL_MINUTES ?? 5);

async function startConsumer() {
  if (!process.env.REDIS_URL) {
    console.log("[worker] REDIS_URL not set — inline queue mode (tasks run inside the web process). Scheduler only.");
    return;
  }
  const { Worker } = await import("bullmq");
  const { Redis } = await import("ioredis");
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker(QUEUE_NAME, async (job) => runTask(job.name as TaskName, job.data as TaskPayloads[TaskName]), { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4) });
  worker.on("completed", (job) => console.log(`[worker] ${job.name} #${job.id} done`));
  worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} #${job?.id} failed: ${err.message}`));
  console.log(`[worker] consuming queue "${QUEUE_NAME}"`);
}

async function forEachOrg(fn: (orgId: string) => Promise<void>) {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const o of orgs) {
    try {
      await fn(o.id);
    } catch (e) {
      console.error(`[scheduler] org ${o.id}:`, e);
    }
  }
}

function every(minutes: number, name: string, fn: () => Promise<void>) {
  const run = () => fn().catch((e) => console.error(`[scheduler:${name}]`, e));
  setTimeout(run, 5000);
  setInterval(run, Math.max(1, minutes) * 60 * 1000);
  console.log(`[scheduler] ${name} every ${minutes} min`);
}

async function main() {
  await startConsumer();
  const { enqueue } = await import("../lib/queue");
  every(DISCOVERY_MIN, "discovery", () => forEachOrg((orgId) => enqueue("discovery", { orgId }).then(() => undefined)));
  every(REPLY_MIN, "poll_replies", () => forEachOrg((orgId) => enqueue("poll_replies", { orgId }).then(() => undefined)));
  every(5, "flush_scheduled", async () => { await flushScheduled(); });
  console.log("[worker] started");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
