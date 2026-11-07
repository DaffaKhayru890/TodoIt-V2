import type { DatabaseProbe } from './ports/database-probe';

export type DependencyState = 'connected' | 'unavailable';

export interface ServiceReadiness {
  readonly status: 'ready' | 'unavailable';
  readonly database: DependencyState;
}

/** Batas waktu pemeriksaan agar request /ready tidak menggantung tanpa batas. */
export const DEFAULT_PROBE_TIMEOUT_MS = 1_000;

/**
 * Use case readiness. Orkestrasi (timeout, penerjemahan hasil probe ke status
 * layanan) berada di sini supaya Infrastructure tetap tipis dan mudah diganti.
 */
export class CheckServiceReadiness {
  constructor(
    private readonly databaseProbe: DatabaseProbe,
    private readonly timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS
  ) {}

  async execute(): Promise<ServiceReadiness> {
    const database = await this.probeWithTimeout();

    return {
      status: database === 'connected' ? 'ready' : 'unavailable',
      database
    };
  }

  private async probeWithTimeout(): Promise<DependencyState> {
    // Probe sudah dikonversi menjadi nilai, bukan rejection, supaya promise yang
    // selesai belakangan tidak memicu unhandled rejection setelah timeout menang.
    const probeResult = this.databaseProbe.probe().then(
      () => 'connected' as DependencyState,
      () => 'unavailable' as DependencyState
    );

    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutResult = new Promise<DependencyState>((resolve) => {
      timer = setTimeout(() => resolve('unavailable'), this.timeoutMs);
    });

    try {
      return await Promise.race([probeResult, timeoutResult]);
    } finally {
      clearTimeout(timer);
    }
  }
}
