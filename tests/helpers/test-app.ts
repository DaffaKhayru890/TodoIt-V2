import { createApp } from '../../src/bootstrap/create-app';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import type { DatabaseProbe } from '../../src/modules/health/application/ports/database-probe';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import type { AppConfig } from '../../src/config/app-config';
import type { LogLevel } from '../../src/config/env-schema';
import { buildTestAppConfig } from './test-app-config';

/** Probe yang selalu menyatakan database hidup. */
export const connectedProbe: DatabaseProbe = { probe: () => Promise.resolve() };

/** Probe yang gagal dengan pesan teknis lengkap, dipakai untuk menguji kebocoran detail. */
export const failingProbe: DatabaseProbe = {
  probe: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.1:5432 user=svc_todo db=todo_test'))
};

/** Probe yang tidak pernah selesai, dipakai untuk menguji batas waktu readiness. */
export const hangingProbe: DatabaseProbe = {
  probe: () => new Promise<void>(() => undefined)
};

export interface BuildTestAppOptions {
  readonly probe?: DatabaseProbe;
  readonly readinessTimeoutMs?: number;
  readonly logLevel?: LogLevel;
  readonly config?: Partial<AppConfig>;
}

export interface TestApp {
  readonly app: ReturnType<typeof createApp>;
  readonly config: AppConfig;
  /** Baris log terstruktur yang dihasilkan selama request, untuk diaudit test. */
  readonly logs: string[];
}

/**
 * Merakit aplikasi Elysia di memori (tanpa port) dengan dependensi bawaan test,
 * sehingga route dapat diuji lewat app.handle(Request).
 */
export function buildTestApp(options: BuildTestAppOptions = {}): TestApp {
  const config = buildTestAppConfig(options.config);
  const logs: string[] = [];
  const logger = createLogger(options.logLevel ?? config.logLevel, (line) => {
    logs.push(line);
  });
  const readiness = new CheckServiceReadiness(
    options.probe ?? connectedProbe,
    options.readinessTimeoutMs ?? 50
  );

  return { app: createApp({ config, logger, readiness }), config, logs };
}

/** Membuat Request GET untuk dikirim ke app.handle tanpa membuka port server. */
export function getRequest(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://test.local${path}`, { headers });
}
