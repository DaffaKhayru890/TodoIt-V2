import { FiBell } from 'react-icons/fi';
import { IconButton } from '@/components/ui/icon-button/icon-button';
import { useUnreadNotificationCount } from '../../hooks/use-notifications';
import { NotificationBadge } from '../notification-badge/NotificationBadge';

export function NotificationBell({ onOpen }: { onOpen: () => void }) {
  const unreadQuery = useUnreadNotificationCount();
  const unreadCount = unreadQuery.data ?? 0;
  const label =
    unreadCount > 0
      ? `Buka notifikasi, ${unreadCount} belum dibaca`
      : 'Buka notifikasi';

  return (
    <div className="notification-bell">
      <IconButton
        label={label}
        aria-haspopup="dialog"
        onClick={onOpen}
        className="notification-bell__button"
      >
        <FiBell />
        <NotificationBadge count={unreadCount} />
      </IconButton>
    </div>
  );
}
