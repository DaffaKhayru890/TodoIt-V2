import { formatDate } from '@/features/todos/utils/date-format';

const MINUTE = 60_000;
const HOUR = 3_600_000;

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isYesterday(value: Date, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  return isSameLocalDay(value, yesterday);
}

/** Format waktu deterministik untuk notification list. */
export function formatNotificationTime(createdAt: Date, now: Date): string {
  const diff = now.getTime() - createdAt.getTime();

  if (diff < MINUTE) {
    return 'Baru saja';
  }

  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} menit lalu`;
  }

  if (isSameLocalDay(createdAt, now)) {
    return `${Math.floor(diff / HOUR)} jam lalu`;
  }

  if (isYesterday(createdAt, now)) {
    return 'Kemarin';
  }

  return formatDate(createdAt);
}
