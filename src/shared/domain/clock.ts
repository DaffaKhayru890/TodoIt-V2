/**
 * Sumber waktu tunggal untuk seluruh business module.
 *
 * Clock sengaja berupa port (interface) supaya use case dan domain service
 * dapat diuji secara deterministik dengan FixedClock tanpa menunggu waktu
 * nyata. Implementasi production memakai system clock.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Clock deterministik untuk test; waktu tidak pernah bergerak sendiri. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date) {
    this.current = new Date(initial.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date): void {
    this.current = new Date(next.getTime());
  }

  advanceByMilliseconds(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
