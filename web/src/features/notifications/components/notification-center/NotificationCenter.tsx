import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button/button';
import { Modal } from '@/components/ui/modal/modal';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { paths } from '@/app/router/route-paths';
import { ApiError } from '@/core/errors/api-error';
import { joinClasses } from '@/core/utils/join-classes';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount
} from '../../hooks/use-notifications';
import type {
  AppNotification,
  NotificationReadStatus
} from '../../models/notification.model';
import { flattenNotificationPages } from '../../utils/flatten-notification-pages';
import { getNotificationTarget } from '../../utils/notification-navigation';
import { NotificationEmptyState } from '../notification-empty-state/NotificationEmptyState';
import { NotificationList } from '../notification-list/NotificationList';

const FILTERS: readonly { value: NotificationReadStatus; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'unread', label: 'Belum dibaca' },
  { value: 'read', label: 'Dibaca' }
];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationReadStatus>('all');
  const [now, setNow] = useState(() => new Date());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const notificationsQuery = useNotifications({ readStatus: filter, enabled: open });
  const unreadQuery = useUnreadNotificationCount({ enabled: open });
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();

  const notifications = useMemo(
    () => flattenNotificationPages(notificationsQuery.data?.pages),
    [notificationsQuery.data]
  );

  useEffect(() => {
    if (open) {
      setNow(new Date());
    }
  }, [open]);

  useEffect(() => {
    setStatusMessage(null);
    setErrorMessage(null);
  }, [filter, open]);

  useIntersectionObserver({
    targetRef: sentinelRef,
    enabled:
      open &&
      Boolean(notificationsQuery.hasNextPage) &&
      !notificationsQuery.isFetchingNextPage &&
      !notificationsQuery.isFetchNextPageError,
    onIntersect: () => {
      void notificationsQuery.fetchNextPage();
    }
  });

  const clearFeedback = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleMarkRead = async (notification: AppNotification) => {
    if (notification.readAt !== null) {
      return;
    }

    clearFeedback();

    try {
      await markRead.mutateAsync(notification.id);
      setStatusMessage('Notifikasi ditandai sudah dibaca.');
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Gagal menandai notifikasi sebagai dibaca. Silakan coba lagi.')
      );
    }
  };

  const handleOpen = async (notification: AppNotification) => {
    const target = getNotificationTarget(notification);
    clearFeedback();

    if (notification.readAt === null) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch (error) {
        setErrorMessage(
          getErrorMessage(error, 'Gagal menandai notifikasi sebagai dibaca. Silakan coba lagi.')
        );
        return;
      }
    }

    if (!target) {
      setStatusMessage('Notifikasi tidak memiliki tugas terkait yang dapat dibuka.');
      return;
    }

    onClose();
    navigate(target);
  };

  const handleMarkAll = async () => {
    clearFeedback();

    try {
      const updated = await markAllRead.mutateAsync();
      setStatusMessage(
        updated > 0 ? `${updated} notifikasi ditandai sudah dibaca.` : 'Tidak ada notifikasi yang perlu ditandai.'
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, 'Gagal menandai semua notifikasi. Silakan coba lagi.')
      );
    }
  };

  const showInitialLoading = notificationsQuery.isLoading;
  const showInitialError = notificationsQuery.isError && notifications.length === 0;
  const showEmpty =
    !showInitialLoading && !showInitialError && notifications.length === 0;
  const unreadCount = unreadQuery.data ?? 0;

  return (
    <Modal
      open={open}
      title="Notifikasi"
      onClose={onClose}
      className="modal--notifications"
    >
      <div className="notification-center">
        <div className="notification-center__toolbar">
          <div className="notification-center__filters" role="group" aria-label="Filter notifikasi">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={joinClasses(
                  'notification-center__filter',
                  filter === item.value && 'notification-center__filter--active'
                )}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="small"
            disabled={unreadCount === 0 || markAllRead.isPending}
            loading={markAllRead.isPending}
            onClick={() => {
              void handleMarkAll();
            }}
          >
            Tandai semua dibaca
          </Button>
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {showInitialLoading
            ? 'Memuat notifikasi.'
            : `${notifications.length} notifikasi ditampilkan.`}
        </p>

        {statusMessage ? (
          <div className="notification-center__feedback notification-center__feedback--success" role="status">
            {statusMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="notification-center__feedback notification-center__feedback--error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {showInitialLoading ? <NotificationSkeleton /> : null}

        {showInitialError ? (
          <div className="notification-center__state" role="alert">
            <p>{getErrorMessage(notificationsQuery.error, 'Gagal memuat notifikasi.')}</p>
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() => {
                void notificationsQuery.refetch();
              }}
            >
              Coba lagi
            </Button>
          </div>
        ) : null}

        {showEmpty ? <NotificationEmptyState filtered={filter !== 'all'} /> : null}

        {notifications.length > 0 ? (
          <div className="notification-center__body">
            <NotificationList
              notifications={notifications}
              now={now}
              markReadPendingId={markRead.isPending ? (markRead.variables ?? null) : null}
              onOpen={(notification) => {
                void handleOpen(notification);
              }}
              onMarkRead={(notification) => {
                void handleMarkRead(notification);
              }}
            />

            {notificationsQuery.isFetchNextPageError ? (
              <div className="notification-center__next-error" role="alert">
                <span>Gagal memuat notifikasi berikutnya.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  onClick={() => {
                    void notificationsQuery.fetchNextPage();
                  }}
                >
                  Coba lagi
                </Button>
              </div>
            ) : null}

            {notificationsQuery.isFetchingNextPage ? (
              <p className="notification-center__loading-more" role="status">
                Memuat notifikasi berikutnya…
              </p>
            ) : null}

            {notificationsQuery.hasNextPage ? (
              <>
                <div ref={sentinelRef} className="notification-center__sentinel" aria-hidden="true" />
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  fullWidth
                  onClick={() => {
                    void notificationsQuery.fetchNextPage();
                  }}
                >
                  Muat lebih banyak
                </Button>
              </>
            ) : (
              <p className="notification-center__end">
                Semua notifikasi pada filter ini sudah dimuat.
              </p>
            )}
          </div>
        ) : null}

        <footer className="notification-center__footer">
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => {
              onClose();
              navigate(paths.settings);
            }}
          >
            Preferensi notifikasi
          </Button>
          <span className="notification-center__delivery-note">
            Pembaruan melalui polling 60 detik; tidak ada WebSocket/Web Push.
          </span>
        </footer>
      </div>
    </Modal>
  );
}

function NotificationSkeleton() {
  return (
    <div className="notification-center__skeleton" aria-busy="true" aria-label="Memuat notifikasi">
      {[0, 1, 2].map((index) => (
        <div className="notification-center__skeleton-row" key={index}>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>
      ))}
    </div>
  );
}
