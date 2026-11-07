import { describeAppConfig, loadAppConfig } from './config/app-config';
import { EnvironmentConfigurationError } from './config/env';
import { createApp } from './bootstrap/create-app';
import { createApplicationContainer } from './bootstrap/container';

function reportConfigurationError(error: EnvironmentConfigurationError): void {
  process.stderr.write(`Aplikasi tidak dapat dimulai.

${error.problems.map((problem) => `  - ${problem}`).join('\n')}

Periksa file environment pada environment aktif (lihat docs/development/environment-configuration.md).\n`);
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

  const container = createApplicationContainer(config);
  const logger = container.logger.child({ component: 'server' });
  const app = createApp({
    config,
    logger: container.logger,
    readiness: container.readiness,
    auth: container.auth,
    workspace: container.workspace,
    todo: container.todo
  }).listen({ port: config.port, hostname: config.host });

  logger.info('server started', describeAppConfig(config));

  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info('shutdown started', { signal });

    try {
      // Berhenti menerima request baru lebih dulu, baru lepas resource teknis,
      // supaya request yang sedang berjalan sempat diselesaikan.
      await app.stop();
      await container.close();

      logger.info('shutdown complete');
      process.exit(0);
    } catch (shutdownError) {
      logger.error('shutdown failed', {
        errorName: shutdownError instanceof Error ? shutdownError.name : typeof shutdownError
      });
      process.exit(1);
    }
  };

  process.on('SIGINT', (signal) => void shutdown(signal));
  process.on('SIGTERM', (signal) => void shutdown(signal));

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', {
      reasonName: reason instanceof Error ? reason.name : typeof reason
    });
  });
}

main();
