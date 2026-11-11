import type { AppNotification } from '../../models/notification.model';
import { groupNotificationsByDate } from '../../utils/notification-group';
import { NotificationItem } from '../notification-item/NotificationItem';

export function NotificationList({
  notifications,
  now,
  markReadPendingId,
  onOpen,
  onMarkRead
}: {
  readonly notifications: readonly AppNotification[];
  readonly now: Date;
  readonly markReadPendingId: string | null;
  readonly onOpen: (notification: AppNotification) => void;
  readonly onMarkRead: (notification: AppNotification) => void;
}) {
  const groups = groupNotificationsByDate(notifications, now);

  return (
    <div className="notification-list">
      {groups.map((group) => (
        <section
          className="notification-list__group"
          key={group.key}
          aria-labelledby={`${group.key}-heading`}
        >
          <h3 id={`${group.key}-heading`} className="notification-list__heading">
            {group.label}
          </h3>
          <ul className="notification-list__items">
            {group.items.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  notification={notification}
                  now={now}
                  isMarkingRead={markReadPendingId === notification.id}
                  onOpen={onOpen}
                  onMarkRead={onMarkRead}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
