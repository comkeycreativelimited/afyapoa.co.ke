import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '@afyapoa/config';
import { logger } from '@afyapoa/logger';

const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

logger.info('[WORKER] Initializing COMKEY AFYA POA background job processors...');

// 1. Health-check & Heartbeat queue worker
const healthWorker = new Worker(
  'health-check',
  async (job: Job) => {
    logger.debug(`[WORKER:health-check] Processing job ${job.id}`, { data: job.data });
    return { status: 'processed', timestamp: new Date().toISOString() };
  },
  { connection: redisConnection },
);

// 2. Outbound DHA HIE dispatch worker
const hieWorker = new Worker(
  'hie-outbound',
  async (job: Job) => {
    logger.info(`[WORKER:hie-outbound] Dispatching FHIR payload for job ${job.id}`, { data: job.data });
    return { status: 'dispatched', bundleId: `DHA-${Date.now()}` };
  },
  { connection: redisConnection },
);

// 3. Outbound SHA eClaims dispatch worker
const claimsWorker = new Worker(
  'claims-outbound',
  async (job: Job) => {
    logger.info(`[WORKER:claims-outbound] Submitting eClaim for job ${job.id}`, { data: job.data });
    return { status: 'submitted', claimTrackingNumber: `SHA-${Date.now()}` };
  },
  { connection: redisConnection },
);

const workers = [healthWorker, hieWorker, claimsWorker];

for (const worker of workers) {
  worker.on('completed', (job: Job) => {
    logger.debug(`[WORKER] Job ${job.id} on queue ${job.queueName} completed successfully.`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error(`[WORKER] Job ${job?.id} on queue ${job?.queueName} failed`, err.stack);
  });
}

logger.info('[WORKER] Background queue workers active and listening for events.');

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`[WORKER] Received ${signal}. Closing BullMQ workers...`);
  await Promise.all(workers.map((w) => w.close()));
  await redisConnection.quit();
  logger.info('[WORKER] All background workers cleanly stopped.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
