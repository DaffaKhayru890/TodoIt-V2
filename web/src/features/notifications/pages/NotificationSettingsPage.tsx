import { PageHeader } from '@/pages/page-header';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { NotificationPreferences } from '../components/notification-preferences/NotificationPreferences';

export function NotificationSettingsPage() {
  useDocumentTitle('Settings');

  return (
    <div className="settings-page">
      <PageHeader
        title="Settings"
        description="Kelola preferensi aplikasi. Bagian notifikasi di bawah terhubung langsung ke backend."
      />
      <NotificationPreferences />
    </div>
  );
}
