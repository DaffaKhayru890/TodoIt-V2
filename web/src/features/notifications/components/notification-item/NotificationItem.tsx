import { useId } from 'react';
import { Badge } from '@/components/ui/badge/badge';
import { joinClasses } from '@/core/utils/join-classes';
import type { AppNotification } from '../../models/notification.model';
import { getNotificationTypeConfig } from '../../utils/notification-label';
import { getNotificationTarget, getNotificationTargetLabel } from '../../utils/notification-navigation';
import { formatNotificationTime } from '../../utils/notification-time';

export function NotificationItem({
  notification,
  now,
  isMarkingRead,
  onOpen,
  onMarkRead
}: {
  readonly notification: AppNotification;
  readonly now: Date;
  readonly isMarkingRead: boolean;
  readonly onOpen: (notification: AppNotification) => void;
  readonly onMarkRead: (notification: AppNotification) => void;
}) {
  const titleId = useId();
  const unread = notification.readAt === null;
  const type = getNotificationTypeConfig(notification.type);
  const target = getNotificationTarget(notification);

  return (
    <article
      className={joinClasses('notification-item', unread && 'notification-item--unread')}
      aria-labelledby={titleId}
    >
      <div className="notification-item__top">
        <Badge variant={type.tone === 'danger' ? 'danger' : 'warning'}>{type.label}</Badge>
        <span className="notification-item__time">
          {formatNotificationTime(notification.createdAt, now)}
        </span>
        {unread ? (
          <>
            <span className="notification-item__marker" aria-hidden="true">
              ●
            </span>
            <span className="visually-hidden">Belum dibaca</span>
          </>
        ) : (
          <span className="notification-item__read-label">Dibaca</span>
        )}
      </div>

      <button
        type="button"
        className="notification-item__open"
        onClick={() => onOpen(notification)}
        aria-label={`${notification.title}. ${getNotificationTargetLabel(notification)}`}
      >
        <span id={titleId} className="notification-item__title">
          {notification.title}
        </span>
        <span className="notification-item__body">{notification.body}</span>
        {target ? <span className="notification-item__target">Buka tugas terkait</span> : null}
      </button>

      {unread ? (
        <button
          type="button"
          className="notification-item__mark-read"
          disabled={isMarkingRead}
          onClick={() => onMarkRead(notification)}
        >
          {isMarkingRead ? 'Menandai…' : 'Tandai dibaca'}
        </button>
      ) : null}
    </article>
  );
}
