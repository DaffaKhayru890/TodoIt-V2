import { useCallback, useEffect, useState } from 'react';

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface BrowserNotificationInput {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly href?: string;
}

export interface BrowserNotificationsController {
  readonly isSupported: boolean;
  readonly permission: BrowserNotificationPermission;
  requestPermission(): Promise<BrowserNotificationPermission>;
  showNotification(input: BrowserNotificationInput): boolean;
}

const shownNotificationIds = new Set<string>();

/** Test helper; tidak dipakai di production. */
export function resetShownBrowserNotificationIds(): void {
  shownNotificationIds.clear();
}

function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function readBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!supportsNotifications()) {
    return 'unsupported';
  }

  return Notification.permission;
}

/**
 * Integrasi Browser Notification API, bukan Web Push.
 *
 * Tidak ada service worker, subscription, atau VAPID key karena backend belum
 * menyediakan infrastruktur push. Notifikasi browser hanya ditampilkan ketika
 * pengguna sudah memberi izin secara eksplisit dan aplikasi mendeteksi
 * notifikasi baru lewat polling.
 */
export function useBrowserNotifications(): BrowserNotificationsController {
  const isSupported = supportsNotifications();
  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    readBrowserNotificationPermission
  );

  useEffect(() => {
    if (!supportsNotifications()) {
      return;
    }

    function syncPermission() {
      setPermission(readBrowserNotificationPermission());
    }

    window.addEventListener('focus', syncPermission);

    return () => {
      window.removeEventListener('focus', syncPermission);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<BrowserNotificationPermission> => {
    if (!supportsNotifications()) {
      setPermission('unsupported');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      setPermission(readBrowserNotificationPermission());
      return readBrowserNotificationPermission();
    }
  }, []);

  const showNotification = useCallback(
    (input: BrowserNotificationInput): boolean => {
      if (!supportsNotifications() || Notification.permission !== 'granted') {
        return false;
      }

      if (shownNotificationIds.has(input.id)) {
        return false;
      }

      shownNotificationIds.add(input.id);

      try {
        const notification = new Notification(input.title, {
          body: input.body,
          tag: input.id
        });

        notification.onclick = () => {
          window.focus();
          notification.close();

          if (input.href) {
            window.location.assign(input.href);
          }
        };

        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return { isSupported, permission, requestPermission, showNotification };
}
