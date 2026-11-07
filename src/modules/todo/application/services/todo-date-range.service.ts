import { addDays, startOfDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { Clock } from '../../../../shared/domain/clock';
import { isValidTimeZone } from '../../../../shared/domain/time/timezone';
import { TodoError } from '../../domain/errors/todo-error';

export const DEFAULT_UPCOMING_DAYS = 7;
export const MIN_UPCOMING_DAYS = 1;
export const MAX_UPCOMING_DAYS = 30;

export interface TimeZoneDateRange {
  readonly timezone: string;
  /** Inclusive. */
  readonly start: Date;
  /** Exclusive. */
  readonly end: Date;
}

/**
 * Perhitungan tanggal kalender berbasis IANA timezone.
 *
 * Konversi dilakukan dengan date-fns-tz, bukan offset tetap, supaya perubahan
 * DST (mis. America/New_York) tetap benar. Interval selalu
 * [startOfDay, startOfNextDay).
 */
export class TodoDateRangeService {
  constructor(
    private readonly clock: Clock,
    private readonly defaultTimezone: string
  ) {}

  resolveTimezone(timezone: string | null | undefined): string {
    const candidate = timezone?.trim();

    if (candidate === undefined || candidate.length === 0) {
      return this.defaultTimezone;
    }

    if (!isValidTimeZone(candidate)) {
      throw TodoError.invalidTimezone();
    }

    return candidate;
  }

  today(timezone?: string | null): TimeZoneDateRange {
    const resolved = this.resolveTimezone(timezone);
    const start = this.startOfDayInTimeZone(this.clock.now(), resolved);
    const end = this.addCalendarDays(start, resolved, 1);

    return { timezone: resolved, start, end };
  }

  /**
   * Upcoming dimulai dari awal hari besok dan berakhir pada awal hari
   * (today + days + 1). Default 7 berarti 7 hari kalender setelah hari ini,
   * yaitu besok sampai hari ke-7.
   */
  upcoming(timezone?: string | null, days: number = DEFAULT_UPCOMING_DAYS): TimeZoneDateRange {
    this.assertUpcomingDays(days);

    const resolved = this.resolveTimezone(timezone);
    const todayStart = this.startOfDayInTimeZone(this.clock.now(), resolved);
    const start = this.addCalendarDays(todayStart, resolved, 1);
    const end = this.addCalendarDays(todayStart, resolved, days + 1);

    return { timezone: resolved, start, end };
  }

  /** Overdue: dueAt < awal hari ini menurut timezone yang diminta. */
  overdue(timezone?: string | null): TimeZoneDateRange {
    const resolved = this.resolveTimezone(timezone);
    const start = this.startOfDayInTimeZone(this.clock.now(), resolved);
    const end = this.addCalendarDays(start, resolved, 1);

    return { timezone: resolved, start, end };
  }

  private assertUpcomingDays(days: number): void {
    if (!Number.isInteger(days) || days < MIN_UPCOMING_DAYS || days > MAX_UPCOMING_DAYS) {
      throw TodoError.invalidUpcomingRange(
        `Parameter days harus bilangan bulat antara ${MIN_UPCOMING_DAYS} dan ${MAX_UPCOMING_DAYS}.`
      );
    }
  }

  private startOfDayInTimeZone(instant: Date, timezone: string): Date {
    const zoned = toZonedTime(instant, timezone);

    return fromZonedTime(startOfDay(zoned), timezone);
  }

  /**
   * Menambah hari kalender pada dinding jam lokal, bukan 24 jam pada UTC.
   * Perbedaan ini penting pada hari pergantian DST.
   */
  private addCalendarDays(startUtc: Date, timezone: string, days: number): Date {
    const zonedStart = toZonedTime(startUtc, timezone);

    return fromZonedTime(addDays(zonedStart, days), timezone);
  }
}
