export interface Metrics {
  increment(name: string, value?: number): void;
  observe(name: string, value: number): void;
  snapshot(): Readonly<Record<string, number>>;
}

/**
 * Counter dalam proses. Label sengaja tidak dipakai supaya user id, todo id,
 * dan job id tidak menjadi deret metrik yang tak terbatas.
 * Provider eksternal dapat mengganti implementasi ini di composition root.
 */
export class InProcessMetrics implements Metrics {
  private readonly values = new Map<string, number>();

  increment(name: string, value = 1): void {
    this.values.set(name, (this.values.get(name) ?? 0) + value);
  }

  observe(name: string, value: number): void {
    const countKey = `${name}.count`;
    const sumKey = `${name}.sum`;
    this.values.set(countKey, (this.values.get(countKey) ?? 0) + 1);
    this.values.set(sumKey, (this.values.get(sumKey) ?? 0) + value);
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.values);
  }
}
