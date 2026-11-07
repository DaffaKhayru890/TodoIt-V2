import { describe, expect, test } from 'bun:test';
import { loadAppConfig } from '../../src/config/app-config';

const projectRoot = new URL('../..', import.meta.url).pathname;
const testConfig = loadAppConfig();

async function waitForHttpOk(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return response;
      }

      lastError = new Error(`status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(50);
  }

  throw new Error(`${url} tidak siap dalam ${timeoutMs}ms: ${String(lastError)}`);
}

describe('Siklus hidup proses server', () => {
  test('startup lalu graceful shutdown dengan SIGTERM', async () => {
    const proc = Bun.spawn({
      cmd: [process.execPath, '--env-file=.env.test', 'src/main.ts'],
      cwd: projectRoot,
      env: { ...process.env, APP_PORT: '4111', APP_HOST: '127.0.0.1', LOG_LEVEL: 'info' },
      stdout: 'pipe',
      stderr: 'pipe'
    });

    try {
      const health = await waitForHttpOk('http://127.0.0.1:4111/health', 6_000);

      expect(await health.json()).toEqual({ status: 'ok' });

      // /ready memakai database test nyata dari environment file.
      const ready = await waitForHttpOk('http://127.0.0.1:4111/ready', 6_000);

      expect(ready.status).toBe(200);

      proc.kill('SIGTERM');

      const exitCode = await Promise.race([
        proc.exited,
        Bun.sleep(5_000).then(() => 'timeout' as const)
      ]);

      expect(exitCode).toBe(0);

      const stdout = await new Response(proc.stdout).text();

      expect(stdout).toInclude('server started');
      expect(stdout).toInclude('shutdown started');
      expect(stdout).toInclude('shutdown complete');
    } finally {
      proc.kill('SIGKILL');
    }
  });

  test('gagal startup dengan pesan jelas saat konfigurasi wajib hilang', async () => {
    const proc = Bun.spawn({
      // /dev/null berarti tidak ada variabel yang dimuat dari file.
      cmd: [process.execPath, '--env-file=/dev/null', 'src/main.ts'],
      cwd: projectRoot,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toInclude('Aplikasi tidak dapat dimulai');
    expect(stderr).toInclude('APP_NAME');
    expect(stderr).toInclude('DATABASE_HOST');
    // Kredensial tidak pernah dicetak saat konfigurasi bermasalah.
    expect(stderr).not.toInclude(testConfig.database.password);
  });
});
