import { Button } from '@/components/ui/button/button';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from '../../hooks/use-notification-preferences';
import { useBrowserNotifications } from '../../hooks/use-browser-notifications';
import {
  getNotificationTypeLabel
} from '../../utils/notification-label';
import { NOTIFICATION_TYPES } from '../../models/notification.model';

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Preferensi notifikasi gagal diperbarui. Silakan coba lagi.';
}

export function NotificationPreferences() {
  const preferencesQuery = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const browser = useBrowserNotifications();

  return (
    <div className="notification-preferences">
      <section className="notification-preferences__section" aria-labelledby="notification-channels">
        <h2 id="notification-channels" className="notification-preferences__title">
          Kanal notifikasi
        </h2>

        {preferencesQuery.isLoading ? (
          <div className="notification-preferences__skeleton" aria-busy="true">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        ) : null}

        {preferencesQuery.isError ? (
          <div className="notification-preferences__error" role="alert">
            <p>{getErrorMessage(preferencesQuery.error)}</p>
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() => {
                void preferencesQuery.refetch();
              }}
            >
              Coba lagi
            </Button>
          </div>
        ) : null}

        {preferencesQuery.data ? (
          <div className="notification-preferences__fields">
            <div className="notification-preferences__field">
              <Checkbox label="Notifikasi in-app" defaultChecked disabled />
              <p className="notification-preferences__hint">
                Notifikasi in-app selalu aktif agar riwayat pengingat dan tenggat tetap tersedia.
              </p>
            </div>

            <div className="notification-preferences__field">
              <Checkbox
                label="Kirim notifikasi melalui email"
                checked={preferencesQuery.data.emailEnabled}
                disabled={updatePreferences.isPending}
                onChange={(event) => {
                  updatePreferences.mutate(event.target.checked);
                }}
              />
              <p className="notification-preferences__hint">
                Preferensi email disimpan di backend. Notifikasi lama tidak dikirim ulang.
              </p>
            </div>

            {updatePreferences.isError ? (
              <p className="notification-preferences__error-text" role="alert">
                {getErrorMessage(updatePreferences.error)}
              </p>
            ) : null}

            {updatePreferences.isSuccess ? (
              <p className="notification-preferences__success" role="status">
                Preferensi email berhasil disimpan.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="notification-preferences__section" aria-labelledby="notification-browser">
        <h2 id="notification-browser" className="notification-preferences__title">
          Notifikasi browser
        </h2>
        <p className="notification-preferences__hint">
          Izin browser berbeda dari preferensi backend. Notifikasi in-app tetap berfungsi meskipun
          izin browser ditolak.
        </p>

        <div className="notification-preferences__browser" role="status" aria-live="polite">
          {browser.permission === 'unsupported' ? (
            <p>Browser ini tidak mendukung Notification API.</p>
          ) : null}

          {browser.permission === 'granted' ? (
            <p>
              Izin browser diberikan. Notifikasi browser hanya ditampilkan saat tab aplikasi tidak
              aktif. Tidak ada Web Push karena backend belum menyediakan subscription endpoint.
            </p>
          ) : null}

          {browser.permission === 'denied' ? (
            <p>
              Izin browser ditolak. Aktifkan kembali melalui pengaturan situs pada browser, lalu
              muat ulang halaman. Notifikasi in-app tetap berfungsi.
            </p>
          ) : null}

          {browser.permission === 'default' ? (
            <>
              <p>
                Izin belum diminta. Kami tidak meminta izin saat halaman dibuka. Tekan tombol di
                bawah hanya jika Anda ingin menerima notifikasi browser saat aplikasi tidak aktif.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  void browser.requestPermission();
                }}
              >
                Aktifkan notifikasi browser
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <section className="notification-preferences__section" aria-labelledby="notification-types">
        <h2 id="notification-types" className="notification-preferences__title">
          Jenis notifikasi yang tersedia
        </h2>
        <ul className="notification-preferences__types">
          {NOTIFICATION_TYPES.map((type) => (
            <li key={type}>{getNotificationTypeLabel(type)}</li>
          ))}
        </ul>
        <p className="notification-preferences__hint">
          Backend saat ini hanya menghasilkan notifikasi pengingat dan tenggat mendekat. Notifikasi
          overdue, undangan workspace, dan aktivitas workspace belum tersedia.
        </p>
      </section>
    </div>
  );
}
