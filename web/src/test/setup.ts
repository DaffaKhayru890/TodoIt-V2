import { cleanup, configure } from '@testing-library/react';
import { mockViewport } from '@/test/utils/mock-viewport';
import '@testing-library/jest-dom/vitest';
import { getResponse, type RequestHandler } from 'msw';
import { afterEach } from 'vitest';
import { server } from '@/test/mocks/server';

// Suite berjalan paralel dengan banyak worker. Beri ruang untuk query async
// (mis. daftar workspace) agar assertion tidak flaky saat mesin sibuk.
configure({ asyncUtilTimeout: 5000 });

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = new Request(input, init);
  const handlers = server
    .listHandlers()
    .filter((handler): handler is RequestHandler => handler.kind === 'request');
  const response = await getResponse([...handlers], request);

  if (!response || response.type === 'error') {
    throw new TypeError(`Tidak ada mock untuk ${request.method} ${request.url}`);
  }

  return response;
};

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  mockViewport(false);
});

mockViewport(false);
