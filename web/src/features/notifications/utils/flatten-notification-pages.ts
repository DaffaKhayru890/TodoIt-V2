import type { NotificationListResult } from '../models/notification.model';

/** Menggabungkan halaman notification tanpa menampilkan ID yang sama dua kali. */
export function flattenNotificationPages(
  pages: readonly NotificationListResult[] | undefined
): readonly NotificationListResult['items'][number][] {
  const seen = new Set<string>();
  const items: NotificationListResult['items'][number][] = [];

  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.id)) {
        continue;
      }

      seen.add(item.id);
      items.push(item);
    }
  }

  return items;
}
