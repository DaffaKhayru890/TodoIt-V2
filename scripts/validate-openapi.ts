import { createApp } from '../src/bootstrap/create-app';
import { CheckServiceReadiness } from '../src/modules/health/application/check-service-readiness';
import { createLogger } from '../src/shared/infrastructure/logging/logger';
import { buildTestAppConfig } from '../tests/helpers/test-app-config';

const app = createApp({
  config: buildTestAppConfig(),
  logger: createLogger('silent'),
  readiness: new CheckServiceReadiness({ probe: () => Promise.resolve() })
});
const response = await app.handle(new Request('http://test.local/openapi/json'));

if (response.status !== 200) {
  process.stderr.write(`OpenAPI status ${response.status}\n`);
  process.exit(1);
}

const document = (await response.json()) as { openapi?: string; paths?: Record<string, unknown> };
const required = ['/health', '/ready', '/health/live'];
const missing = required.filter((path) => !document.paths?.[path]);

if (!document.openapi || missing.length > 0) {
  process.stderr.write(`OpenAPI tidak lengkap: ${missing.join(', ')}\n`);
  process.exit(1);
}

process.stdout.write(`openapi ${document.openapi} paths ${Object.keys(document.paths ?? {}).length}\n`);
