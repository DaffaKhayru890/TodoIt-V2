# Notifikasi

Phase 6 menambahkan pusat notifikasi in-app, badge belum dibaca, preferensi, dan notifikasi browser opsional. Seluruh data berasal dari Notification API backend. Tidak ada WebSocket, SSE, atau Web Push karena backend belum menyediakannya.

## Kemampuan backend

Endpoint yang dipakai:

- `GET /api/v1/notifications` dengan `limit`, `cursor`, `readStatus`, dan `type`
- `GET /api/v1/notifications/unread-count`
- `GET /api/v1/notifications/preferences`
- `PATCH /api/v1/notifications/preferences`
- `PATCH /api/v1/notifications/:notificationId/read`
- `PATCH /api/v1/notifications/read-all`

Tipe notifikasi yang didukung schema backend hanya:

- `reminder_due`
- `todo_due_soon`

Tidak ada tipe `overdue`, endpoint detail notifikasi, atau endpoint hapus notifikasi. Fitur detail dan hapus karena itu berstatus **BLOCKED**; detail ditampilkan inline di pusat notifikasi dan tidak ada aksi hapus.

## Pusat notifikasi

`NotificationBell` berada di header layout dan menampilkan jumlah belum dibaca dari endpoint terpisah. Angka di atas 99 ditampilkan sebagai `99+`. Tombol membuka `NotificationCenter` dalam modal.

Isi pusat notifikasi:

- filter **Semua**, **Belum dibaca**, dan **Sudah dibaca**;
- daftar dengan cursor pagination, 20 item per halaman;
- pengelompokan tanggal lokal: **Hari ini**, **Kemarin**, dan **Sebelumnya**;
- waktu relatif (misalnya `30 menit lalu`);
- aksi **Tandai dibaca** per item dan **Tandai semua dibaca**;
- tombol **Muat lebih banyak** dan sentinel infinite scroll;
- tautan ke tugas terkait bila `data.workspaceId` dan `data.todoId` adalah UUID valid;
- tautan ke `/settings` untuk preferensi.

Membuka notifikasi yang memiliki target akan menandainya sudah dibaca, menutup panel, lalu bernavigasi ke detail tugas. Notifikasi tanpa target menampilkan pesan bahwa tugas terkait tidak tersedia dan panel tetap terbuka.

Panjang daftar, filter, dan status baca selalu berasal dari backend. Frontend tidak menghitung unread count dari halaman yang sudah dimuat karena endpoint unread-count terpisah dapat mencakup notifikasi di luar halaman tersebut.

## Polling dan notifikasi baru

`useNotificationUpdates` berjalan di layout dan memakai feed unread:

- polling setiap 60 detik;
- polling dihentikan saat tab tersembunyi (`document.hidden`) dan saat query sedang error;
- polling pertama hanya menjadi **baseline**, sehingga notifikasi lama yang belum dibaca tidak memicu toast;
- setelah baseline, ID notifikasi backend dipakai sebagai identitas agar refetch atau render ulang tidak menampilkan notifikasi yang sama dua kali;
- saat tab terlihat, notifikasi baru muncul sebagai toast;
- saat tab tersembunyi, notifikasi baru dapat muncul sebagai browser notification bila izin sudah diberikan;
- setelah notifikasi baru terdeteksi, cache daftar dan unread count diinvalidasi.

Polling bukan jaminan pengiriman real-time. Keterlambatan maksimum mengikuti interval 60 detik dan browser dapat menunda timer pada tab yang tidak aktif.

## Notifikasi browser

Integrasi memakai **Browser Notification API**, bukan Web Push:

- tidak ada service worker, subscription, VAPID key, atau push server;
- izin hanya diminta lewat aksi eksplisit **Aktifkan notifikasi browser** di `/settings`;
- notifikasi browser hanya ditampilkan jika `Notification.permission === 'granted'`;
- setiap ID notifikasi ditampilkan paling banyak sekali per sesi;
- klik notifikasi memfokuskan window dan membuka tugas terkait bila ada;
- bila API tidak tersedia, UI menampilkan status `unsupported`;
- bila izin ditolak, UI menjelaskan cara mengaktifkan kembali lewat pengaturan situs.

## Preferensi notifikasi

Halaman `/settings` menampilkan `NotificationPreferences`:

- **Notifikasi in-app** selalu aktif dan tidak dapat dimatikan karena backend tidak menyediakan kanal untuk menonaktifkannya;
- **Notifikasi email** dapat diubah lewat `PATCH /notifications/preferences`;
- status izin browser ditampilkan terpisah dari preferensi backend;
- perubahan email menampilkan konfirmasi atau pesan error dari API.

## Komponen dan hook

| Berkas                                                                                   | Peran                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `features/notifications/models/notification.dto.ts`                                      | Bentuk respons backend                                 |
| `features/notifications/models/notification.guard.ts`                                    | Validasi runtime respons                               |
| `features/notifications/models/notification.mapper.ts`                                   | Konversi tanggal dan domain model                      |
| `features/notifications/api/notification.api.ts`                                         | Klien Notification API                                 |
| `features/notifications/api/notification.query-keys.ts`                                  | Query key list, feed, unread count, preferences        |
| `features/notifications/hooks/use-notifications.ts`                                      | Infinite list, unread count, mark read/all             |
| `features/notifications/hooks/use-notification-feed.ts`                                  | Feed unread untuk deteksi notifikasi baru              |
| `features/notifications/hooks/use-notification-updates.ts`                               | Polling, toast, browser notification, invalidasi cache |
| `features/notifications/hooks/use-browser-notifications.ts`                              | Izin dan penampilan Browser Notification API           |
| `features/notifications/hooks/use-notification-preferences.ts`                           | Query dan mutation preferensi                          |
| `features/notifications/components/notification-bell/NotificationBell.tsx`               | Tombol header dan badge                                |
| `features/notifications/components/notification-center/NotificationCenter.tsx`           | Modal daftar, filter, aksi, pagination                 |
| `features/notifications/components/notification-item/NotificationItem.tsx`               | Satu notifikasi                                        |
| `features/notifications/components/notification-list/NotificationList.tsx`               | Grup tanggal                                           |
| `features/notifications/components/notification-preferences/NotificationPreferences.tsx` | Preferensi dan izin browser                            |
| `features/notifications/pages/NotificationSettingsPage.tsx`                              | Halaman `/settings`                                    |
| `features/notifications/utils/notification-navigation.ts`                                | Validasi target dan label tautan                       |
| `features/notifications/utils/notification-time.ts`                                      | Waktu relatif                                          |
| `features/notifications/utils/notification-group.ts`                                     | Pengelompokan hari lokal                               |
| `features/notifications/utils/notification-label.ts`                                     | Label dan tone per tipe                                |
| `features/notifications/utils/flatten-notification-pages.ts`                             | Flatten dan dedupe halaman                             |

## Keterbatasan dan status BLOCKED

| Kebutuhan                         | Status                | Alasan                                               |
| --------------------------------- | --------------------- | ---------------------------------------------------- |
| Detail notifikasi                 | BLOCKED               | Tidak ada endpoint detail; detail ditampilkan inline |
| Hapus notifikasi                  | BLOCKED               | Tidak ada endpoint delete                            |
| Notifikasi overdue                | BLOCKED               | Tipe backend tidak tersedia                          |
| WebSocket/SSE                     | BLOCKED               | Backend tidak menyediakan                            |
| Web Push                          | BLOCKED               | Tidak ada service worker/push subscription backend   |
| Mematikan notifikasi in-app       | BLOCKED               | Preferensi backend selalu `inAppEnabled: true`       |
| Jaminan pengiriman latar belakang | Bergantung deployment | Worker/scheduler backend harus aktif                 |

## Pengujian

Test berada di `features/notifications/`:

- `api/notification.api.test.ts`
- `hooks/notification-hooks.test.tsx`
- `utils/notification-utils.test.ts`
- `components/notification-bell/NotificationBell.test.tsx`
- `components/notification-center/NotificationCenter.test.tsx`
- `components/notification-preferences/NotificationPreferences.test.tsx`
- `tests/notification-workflows.test.tsx`

Workflow E membuka pusat notifikasi dari bell, menandai dibaca, lalu membuka tugas terkait. Workflow F memverifikasi browser notification saat tab tersembunyi dan memastikan toast tidak muncul bersamaan.
