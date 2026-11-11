import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { NotificationPreferences } from './NotificationPreferences';

const baseUrl = 'http://localhost:4000';

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
}

describe('NotificationPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission.mockClear();
  });

  test('menampilkan preferensi in-app dan email dari backend', async () => {
    renderWithProviders(<NotificationPreferences />);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Notifikasi in-app' })).toBeChecked()
    );

    expect(screen.getByRole('checkbox', { name: 'Notifikasi in-app' })).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'Kirim notifikasi melalui email' })
    ).not.toBeChecked();
    expect(screen.getByText('Pengingat')).toBeInTheDocument();
    expect(screen.getByText('Tenggat mendekat')).toBeInTheDocument();
  });

  test('mengubah preferensi email dan menampilkan konfirmasi', async () => {
    const user = userEvent.setup();
    let patched = false;

    server.use(
      http.patch(`${baseUrl}/api/v1/notifications/preferences`, async ({ request }) => {
        const body = (await request.json()) as { emailEnabled: boolean };
        patched = true;
        expect(body).toEqual({ emailEnabled: true });

        return HttpResponse.json({
          preferences: { inAppEnabled: true, emailEnabled: true }
        });
      })
    );

    renderWithProviders(<NotificationPreferences />);

    const toggle = await screen.findByRole('checkbox', {
      name: 'Kirim notifikasi melalui email'
    });

    await user.click(toggle);

    expect(await screen.findByText('Preferensi email berhasil disimpan.')).toBeInTheDocument();
    expect(patched).toBe(true);
    expect(toggle).toBeChecked();
  });

  test('menampilkan error ketika pembaruan preferensi gagal', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch(`${baseUrl}/api/v1/notifications/preferences`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Gagal menyimpan.', requestId: 'req-1' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<NotificationPreferences />);

    await user.click(
      await screen.findByRole('checkbox', { name: 'Kirim notifikasi melalui email' })
    );

    expect(await screen.findByText('Gagal menyimpan.')).toBeInTheDocument();
  });

  test('menampilkan error pemuatan preferensi dan mencoba ulang', async () => {
    const user = userEvent.setup();
    let attempt = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/notifications/preferences`, () => {
        attempt += 1;

        if (attempt <= 2) {
          return HttpResponse.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Tidak dapat memuat preferensi.',
                requestId: 'req-2'
              }
            },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          preferences: { inAppEnabled: true, emailEnabled: false }
        });
      })
    );

    renderWithProviders(<NotificationPreferences />);

    expect(await screen.findByText('Tidak dapat memuat preferensi.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Kirim notifikasi melalui email' })
      ).toBeInTheDocument()
    );
  });

  test('meminta izin browser hanya setelah pengguna menekan tombol', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Notification', FakeNotification);

    renderWithProviders(<NotificationPreferences />);

    const enableButton = await screen.findByRole('button', {
      name: 'Aktifkan notifikasi browser'
    });

    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();

    await user.click(enableButton);

    await waitFor(() =>
      expect(screen.getByText(/Izin browser diberikan/i, { selector: 'p' })).toBeInTheDocument()
    );
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  test('menampilkan status izin browser yang ditolak', async () => {
    FakeNotification.permission = 'denied';
    vi.stubGlobal('Notification', FakeNotification);

    renderWithProviders(<NotificationPreferences />);

    expect(
      await screen.findByText(/^Izin browser ditolak\./, { selector: 'p' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Aktifkan notifikasi browser' })
    ).not.toBeInTheDocument();
  });

  test('menampilkan status unsupported tanpa Notification API', async () => {
    Reflect.deleteProperty(window, 'Notification');

    renderWithProviders(<NotificationPreferences />);

    expect(
      await screen.findByText('Browser ini tidak mendukung Notification API.', { selector: 'p' })
    ).toBeInTheDocument();
  });
});
