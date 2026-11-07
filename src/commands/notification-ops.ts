import { loadAppConfig } from '../config/app-config';
import { createWorker } from '../bootstrap/create-worker';

const [command, jobId] = process.argv.slice(2);

async function main(): Promise<void> {
  const config = loadAppConfig();
  const worker = createWorker(config, 'operator');

  try {
    if (command === 'reconcile') {
      const result = await worker.reconciliation.run();
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return;
    }

    if (!jobId) {
      process.stderr.write('Job id wajib diisi.\n');
      process.exitCode = 1;
      return;
    }

    if (command === 'inspect') {
      const job = await worker.queue.findById(jobId);

      if (!job) {
        process.stderr.write('Job tidak ditemukan.\n');
        process.exitCode = 1;
        return;
      }

      const snapshot = job.snapshot;
      process.stdout.write(
        `${JSON.stringify({
          id: snapshot.id,
          type: snapshot.type,
          status: snapshot.status,
          attempts: snapshot.attempts,
          maxAttempts: snapshot.maxAttempts,
          scheduledAt: snapshot.scheduledAt.toISOString(),
          availableAt: snapshot.availableAt.toISOString(),
          lastErrorCode: snapshot.lastErrorCode,
          createdAt: snapshot.createdAt.toISOString(),
          completedAt: snapshot.completedAt?.toISOString() ?? null
        })}\n`
      );
      return;
    }

    if (command === 'retry-failed') {
      const current = await worker.queue.findById(jobId);

      if (!current) {
        process.stderr.write('Job tidak ditemukan.\n');
        process.exitCode = 1;
        return;
      }

      if (current.status !== 'failed') {
        process.stderr.write(`Job berstatus ${current.status} tidak dapat diantri ulang.\n`);
        process.exitCode = 1;
        return;
      }

      const updated = await worker.queue.requeueFailed(jobId, new Date());
      worker.logger.info('failed job requeued', { jobId, workerId: 'operator' });
      process.stdout.write(`${JSON.stringify({ id: updated?.id, status: updated?.status })}\n`);
      return;
    }

    process.stderr.write('Perintah tidak dikenal.\n');
    process.exitCode = 1;
  } finally {
    await worker.database.close();
  }
}

void main();
