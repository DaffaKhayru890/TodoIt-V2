import { EmptyState } from '@/components/feedback/empty-state/empty-state';

export function NotificationEmptyState({ filtered }: { readonly filtered: boolean }) {
  return (
    <EmptyState
      compact
      title="Semua sudah tertangani!"
      description={
        filtered
          ? 'Tidak ada notifikasi yang cocok dengan filter ini.'
          : 'Tidak ada notifikasi baru untuk saat ini.'
      }
    />
  );
}
