export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? '99+' : String(count);

  return (
    <span className="notification-badge" aria-label={`${count} notifikasi belum dibaca`}>
      {label}
    </span>
  );
}
