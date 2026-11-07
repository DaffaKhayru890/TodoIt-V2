import { useEffect } from 'react';

export function MobileNavigationDrawer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <button
      className="mobile-drawer__backdrop"
      type="button"
      aria-label="Tutup navigasi"
      onClick={onClose}
    />
  );
}
