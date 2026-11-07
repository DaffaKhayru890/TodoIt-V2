import { describe, expect, test } from 'bun:test';
import { buildTestApp, getRequest } from '../helpers/test-app';

type OpenApiSpec = {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string }[];
  tags: { name: string }[];
  paths: Record<string, Record<string, {
    description?: string;
    tags?: string[];
    responses: Record<string, { description?: string; content?: Record<string, { schema?: unknown }> }>;
  }>>;
};

async function loadSpec(): Promise<OpenApiSpec> {
  const { app } = buildTestApp();

  const response = await app.handle(getRequest('/openapi/json'));

  expect(response.status).toBe(200);

  return (await response.json()) as OpenApiSpec;
}

describe('OpenAPI documentation', () => {
  test('/openapi/json dapat diakses sebagai JSON', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(getRequest('/openapi/json'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')?.startsWith('application/json')).toBe(true);
  });

  test('/openapi menyajikan dokumentasi interaktif (Scalar) ke browser', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(getRequest('/openapi'));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')?.includes('html')).toBe(true);
    expect(html.toLowerCase()).toContain('scalar');
  });

  test('metadata dokumen memuat judul, versi, deskripsi, server, dan tags', async () => {
    const spec = await loadSpec();

    expect(spec.openapi).toStartWith('3.1');
    expect(spec.info.title).toBe('Todo Backend Test');
    expect(spec.info.version).toBe('0.0.0-test');
    expect(spec.info.description).toInclude('Phase 1');
    expect(spec.servers.length).toBeGreaterThan(0);
    expect(spec.tags.map((tag) => tag.name)).toContain('Health');
  });

  test('health terdokumentasi lengkap', async () => {
    const spec = await loadSpec();
    const health = spec.paths['/health']?.get;

    expect(health).toBeDefined();
    expect(health?.description).toInclude('GET');
    expect(health?.tags).toContain('Health');
    expect(health?.responses['200']?.description).toBeString();
    expect(JSON.stringify(health?.responses['200']?.content)).toInclude('ok');
  });

  test('readiness mendokumentasikan respons sukses dan error 503', async () => {
    const spec = await loadSpec();
    const ready = spec.paths['/ready']?.get;

    expect(ready).toBeDefined();
    expect(Object.keys(ready?.responses ?? {})).toContain('200');
    expect(Object.keys(ready?.responses ?? {})).toContain('503');

    const errorSchema = JSON.stringify(ready?.responses['503']?.content);

    expect(errorSchema).toInclude('requestId');
    expect(errorSchema).toInclude('SERVICE_UNAVAILABLE');
  });

  test('setiap endpoint Phase 1 muncul dalam spesifikasi', async () => {
    const spec = await loadSpec();

    // /openapi dan /openapi/json adalah dokumen itu sendiri, tidak didokumentasikan.
    expect(Object.keys(spec.paths).sort()).toEqual(['/health', '/ready']);
  });
});
