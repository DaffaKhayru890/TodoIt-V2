import { describe, expect, test } from 'bun:test';
import { CheckServiceReadiness, DEFAULT_PROBE_TIMEOUT_MS } from '../../src/modules/health/application/check-service-readiness';
import type { DatabaseProbe } from '../../src/modules/health/application/ports/database-probe';

describe('CheckServiceReadiness', () => {
  test('menyatakan ready saat probe database berhasil', async () => {
    const probe: DatabaseProbe = { probe: () => Promise.resolve() };

    const readiness = await new CheckServiceReadiness(probe).execute();

    expect(readiness).toEqual({ status: 'ready', database: 'connected' });
  });

  test('menyatakan unavailable saat probe menolak', async () => {
    const probe: DatabaseProbe = { probe: () => Promise.reject(new Error('down')) };

    const readiness = await new CheckServiceReadiness(probe).execute();

    expect(readiness).toEqual({ status: 'unavailable', database: 'unavailable' });
  });

  test('menyatakan unavailable dan tidak menggantung saat probe melebihi batas waktu', async () => {
    const probe: DatabaseProbe = { probe: () => new Promise<void>(() => undefined) };

    const startedAt = performance.now();
    const readiness = await new CheckServiceReadiness(probe, 15).execute();

    expect(readiness.status).toBe('unavailable');
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  test('memakai batas waktu default ketika tidak diberikan', async () => {
    const probe: DatabaseProbe = { probe: () => new Promise<void>(() => undefined) };

    const startedAt = performance.now();
    await new CheckServiceReadiness(probe).execute();
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(DEFAULT_PROBE_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(DEFAULT_PROBE_TIMEOUT_MS + 1_000);
  });

  test('memanggil probe tepat satu kali per eksekusi', async () => {
    let calls = 0;
    const probe: DatabaseProbe = {
      probe: () => {
        calls += 1;
        return Promise.resolve();
      }
    };

    const useCase = new CheckServiceReadiness(probe);
    await useCase.execute();
    await useCase.execute();

    expect(calls).toBe(2);
  });
});
