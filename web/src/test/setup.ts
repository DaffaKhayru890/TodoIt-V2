import { cleanup } from '@testing-library/react';
import { mockViewport } from '@/test/utils/mock-viewport';
import '@testing-library/jest-dom/vitest';
import { getResponse, type RequestHandler } from 'msw';
import { afterEach } from 'vitest';
import { server } from '@/test/mocks/server';

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
