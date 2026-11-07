/**
 * Sumber waktu tunggal untuk use case. Dipasang sebagai port supaya test dapat
 * mem-pin waktu tanpa menunggu expiry nyata.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
