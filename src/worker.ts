import { describeAppConfig, loadAppConfig } from './config/app-config';
import { EnvironmentConfigurationError } from './config/env';
import { createWorker } from './bootstrap/create-worker';

function reportConfigurationError(error: EnvironmentConfigurationError): void {
  process.stderr.write(`${error.message}\n`);
}

function main(): void {
  let config;

  try {
    config = loadAppConfig();
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      reportConfigurationError(error);
      process.exit(1);
    }

    throw error;
  }

  if (!config.notification.workerEnabled) {
    process.stderr.write('NOTIFICATION_WORKER_ENABLED=false, worker tidak dijalankan.\n');
    process.exit(0);
  }

  const worker = createWorker(config);
  worker.logger.info('worker process starting', describeAppConfig(config));

  const shutdown = (signal: NodeJS.Signals): void => {
    worker.logger.info('shutdown started', { signal });
    worker.runtime.requestStop();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  void worker.runtime.run().then(
    async () => {
      await worker.database.close();
      process.exit(0);
    },
    async (error: unknown) => {
      worker.logger.error('worker failed', {
        errorName: error instanceof Error ? error.name : 'Error'
      });
      await worker.database.close();
      process.exit(1);
    }
  );
}

main();
