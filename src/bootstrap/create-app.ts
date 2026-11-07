import { Elysia } from 'elysia';
import type { AppConfig } from '../config/app-config';
import { registerModules, type ModuleDependencies } from './register-modules';
import type { Logger } from '../shared/infrastructure/logging/logger';
import { createCorsPlugin } from '../shared/presentation/http/plugins/cors-policy';
import { createOpenApiPlugin } from '../shared/presentation/http/plugins/openapi-documentation';
import { mapErrorToHttpResponse } from '../shared/presentation/http/errors/error-handler';
import {
  REQUEST_ID_HEADER,
  ensureRequestId,
  requestPathOf,
  withRequestContext
} from '../shared/presentation/http/middleware/request-context';

export interface AppDependencies extends ModuleDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
}

/**
 * Merakit instance Elysia tanpa menjalankannya. Fungsi ini dipakai `main.ts`
 * dan test (lewat `app.handle`), sehingga test tidak perlu membuka port.
 */
export function createApp({ config, logger, readiness, auth, workspace, todo, notification }: AppDependencies) {
  // normalize=false membuat field asing TIDAK dibuang diam-diam, sehingga
  // schema dengan additionalProperties:false (mis. body Todo) benar-benar
  // menolak metadata milik server alih-alih menerimanya setelah di-strip.
  const appWithRequestContext = withRequestContext(new Elysia({ normalize: false }), logger);

  return appWithRequestContext
    .use(createCorsPlugin(config))
    .use(createOpenApiPlugin(config))
    .onError(({ error, code, request, set }) => {
      const requestId = ensureRequestId(set, request.headers.get(REQUEST_ID_HEADER));

      // Detail exception hanya masuk ke server log; klien menerima sampul aman.
      logger
        .child({ requestId, component: 'http', method: request.method, path: requestPathOf(request) })
        .error('request failed', {
          code: String(code),
          errorName: error instanceof Error ? error.name : typeof error
        });

      const mappedError = mapErrorToHttpResponse({ error, code, requestId });

      set.status = mappedError.status;

      return mappedError.payload;
    })
    .use(registerModules({ readiness, auth, workspace, todo, notification }));
}
