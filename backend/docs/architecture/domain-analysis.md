# Arsitektur — Domain Analysis

## 1. Cara Membaca

Setiap domain dianalisis dengan struktur yang sama:

1. Tujuan domain.
2. Tanggung jawab.
3. Fitur.
4. Hubungan dengan domain lain.
5. Entitas database.
6. Endpoint.
7. Business logic / aturan.
8. Authorization.
9. Catatan keputusan.

Domain di sini adalah **pengelompokan kebutuhan**, bukan berarti setiap domain menjadi module
terpisah. Pemetaan domain → module ada di akhir dokumen.

---

## 2. Authentication & Authorization

### 2.1 Tujuan

Memastikan identitas pengguna (authentication) dan hak aksesnya (authorization) diverifikasi
di server sebelum data workspace disentuh.

### 2.2 Tanggung Jawab

- Registrasi akun dan hashing password.
- Verifikasi kredensial saat login.
- Penerbitan, verifikasi, dan rotasi token.
- Pengelolaan session refresh token (revocation).
- Menyediakan identitas user ke layer berikutnya.
- Menyediakan guard otorisasi workspace (dipakai domain lain).

### 2.3 Fitur

- Register, login, refresh, logout, logout-all.
- Get current user (`/auth/me`).
- Access token JWT berumur pendek.
- Refresh token opaque berumur panjang dengan rotasi dan deteksi reuse.
- Rate limit login/refresh.
- Pencabutan session tunggal dan seluruh session.

### 2.4 Hubungan dengan Domain Lain

| Domain | Hubungan |
|---|---|
| User Management | `auth` membaca/menulis kredensial lewat port `UserLookup`/`UserWriter`; profil dikelola `users` |
| Workspace Management | Setiap request workspace memakai `userID` dari token |
| Membership | `auth` tidak tahu membership; membership dicek `workspaces` |
| Semua domain | Semua endpoint privat memerlukan access token valid |

### 2.5 Entitas Database

- `users` (dimiliki `users`, dibaca `auth`): `id`, `email`, `password_hash`, `deleted_at`.
- `user_sessions` (dimiliki `auth`): `id`, `user_id`, `refresh_token_hash`, `family_id`,
  `expires_at`, `revoked_at`, `replaced_by_session_id`, `created_at`, `updated_at`.

### 2.6 Endpoint

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/auth/register` | Publik |
| POST | `/api/v1/auth/login` | Publik |
| POST | `/api/v1/auth/refresh` | Publik (memakai refresh token) |
| POST | `/api/v1/auth/logout` | Bearer |
| POST | `/api/v1/auth/logout-all` | Bearer |
| GET | `/api/v1/auth/me` | Bearer |

### 2.7 Business Logic

- Email dinormalisasi (`trim` + lowercase) sebelum simpan/cari.
- Password minimal 8 karakter, maksimal 72 byte (batas bcrypt), wajib mengandung huruf dan
  angka. Tidak ada aturan simbol wajib agar tidak menyulitkan; didokumentasikan di validasi.
- Hash bcrypt cost 12.
- Login gagal selalu mengembalikan pesan generik `INVALID_CREDENTIALS` (tidak membedakan email
  tidak ada vs password salah) dan memakai waktu respons yang seragam.
- Access token 15 menit; refresh token 30 hari.
- Refresh token berupa 32 byte acak (base64url), disimpan sebagai SHA-256 hash.
- Rotasi: setiap refresh membuat session baru dan menandai session lama `revoked_at` +
  `replaced_by_session_id`.
- Reuse detection: jika refresh token yang sudah dirotasi dipakai lagi, seluruh `family_id`
  dicabut (semua turunan session).
- Logout mencabut session yang sedang dipakai (berdasarkan `sid` claim).
- Logout-all mencabut semua session aktif user.
- Register tidak otomatis login; client harus memanggil login (keputusan: mengurangi
  permukaan serangan dan menyederhanakan transaksi).
- User yang `deleted_at` tidak null tidak dapat login/refresh.

### 2.8 Authorization

- Endpoint publik: register, login, refresh.
- Endpoint Bearer: logout, logout-all, me.
- Access token wajib memiliki `sub` (user id), `sid` (session id), `exp`, `iat`, `iss`, `aud`.
- Middleware menolak token dengan signature salah, expired, `iss`/`aud` tidak cocok, atau
  session yang sudah dicabut (cek `sid` ke DB untuk endpoint sensitif; lihat trade-off di
  `authentication-flow.md`).

### 2.9 Catatan Keputusan

- Refresh token disimpan di tabel, bukan access token, agar access token tetap stateless.
- Tidak memakai cookie httpOnly karena API dipakai lintas client; frontend menyimpan token
  sesuai kebijakannya (di luar scope backend).
- Rate limit in-memory cukup untuk satu instance; multi-instance didokumentasikan sebagai
  keterbatasan.

---

## 3. User Management

### 3.1 Tujuan

Mengelola profil pengguna yang bukan bagian dari kredensial: nama, timezone, dan preferensi
dasar yang dibutuhkan fitur tanggal.

### 3.2 Tanggung Jawab

- Menyediakan data user untuk module lain (lookup by ID/email).
- Memperbarui nama dan timezone.
- Validasi timezone IANA.
- Menjadi pemilik tabel `users`.

### 3.3 Fitur

- `GET /users/me` — profil lengkap.
- `PATCH /users/me` — update `name`, `timezone`.
- (Internal) lookup user untuk assignee, undangan, notifikasi.

### 3.4 Hubungan

| Domain | Hubungan |
|---|---|
| Auth | Menyediakan `UserLookup` (email, password_hash) dan `UserWriter` (register) |
| Workspace | Menyediakan `UserDirectory` untuk validasi email undangan dan detail member |
| Task | `assignee_id` merujuk `users.id`; validasi assignee dilakukan `tasks` via membership |
| Notification | `user_id` penerima; email opsional lewat `UserDirectory` |

### 3.5 Entitas

- `users`: `id`, `name`, `email`, `password_hash`, `timezone`, `created_at`, `updated_at`,
  `deleted_at`.

### 3.6 Endpoint

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/users/me` | Bearer |
| PATCH | `/api/v1/users/me` | Bearer |

### 3.7 Business Logic

- `name`: 1–100 karakter setelah trim.
- `email`: tidak dapat diubah lewat endpoint profil pada Phase 0 (butuh verifikasi email;
  tidak disepakati). Perubahan email masuk backlog.
- `timezone`: default `UTC`; harus valid menurut `time.LoadLocation`; disimpan sebagai string
  IANA. Timezone memengaruhi Today/Upcoming/Overdue.
- Perubahan timezone tidak mengubah timestamp tersimpan, hanya cara menghitung batas hari.
- Profil user yang di-soft-delete tidak dapat diakses.

### 3.8 Authorization

- Hanya user pemilik token yang dapat membaca/mengubah profilnya.
- Tidak ada endpoint admin untuk mengelola user lain pada Phase 0.
- `user_id` tidak pernah diambil dari body/query untuk endpoint ini.

---

## 4. Workspace Management

### 4.1 Tujuan

Menyediakan ruang kerja terisolasi tempat task, tag, label, dan anggota dikelola.

### 4.2 Tanggung Jawab

- CRUD workspace.
- Menetapkan owner saat pembuatan.
- Soft delete workspace beserta dampaknya.
- Menjadi batas isolasi data (workspace scope).

### 4.3 Fitur

- Create workspace (otomatis menambahkan owner sebagai member `OWNER`).
- List workspace milik user (hanya yang menjadi member).
- Get detail workspace (beserta role user).
- Update nama/deskripsi (OWNER/ADMIN).
- Delete (soft delete) workspace (OWNER saja).

### 4.4 Hubungan

| Domain | Hubungan |
|---|---|
| Membership | Setiap workspace wajib punya minimal satu OWNER |
| Invitation | Undangan selalu terikat workspace |
| Task/Tag/Label | Semua data operasional membawa `workspace_id` |
| Notification | Notifikasi membawa `workspace_id` untuk konteks |
| Authorization | Membership menentukan akses |

### 4.5 Entitas

- `workspaces`: `id`, `name`, `description`, `owner_id`, `created_at`, `updated_at`,
  `deleted_at`.
- `workspace_members`: lihat domain Membership.

### 4.6 Endpoint

| Method | Path |
|---|---|
| POST | `/api/v1/workspaces` |
| GET | `/api/v1/workspaces` |
| GET | `/api/v1/workspaces/{workspace_id}` |
| PATCH | `/api/v1/workspaces/{workspace_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}` |

### 4.7 Business Logic

- Create: nama 1–100 karakter; deskripsi maksimal 1000; dalam satu transaksi buat workspace +
  member OWNER.
- `owner_id` harus sama dengan user pembuat.
- Workspace yang dihapus tidak muncul di list dan tidak dapat diakses (404), tetapi baris
  tetap ada untuk audit.
- Nama workspace tidak unik (user boleh punya dua workspace bernama sama).
- Delete workspace: soft delete workspace; task di dalamnya otomatis tidak dapat diakses karena
  semua query memfilter workspace aktif. Task **tidak** di-soft-delete satu per satu (menghindari
  operasi massal besar); ini keputusan yang didokumentasikan. Dalam transaksi yang sama, semua
  reminder `PENDING`/`FAILED` milik workspace di-`CANCELLED` agar worker tidak membuat
  notifikasi untuk workspace yang sudah dihapus. Worker tetap memeriksa status workspace
  sebagai jaring pengaman (lihat `notification-worker.md` §6.4).
- Update workspace tidak mengubah owner.

### 4.8 Authorization

| Aksi | Role |
|---|---|
| Create | User terautentikasi |
| List | User terautentikasi (hasil difilter membership) |
| Read | Member (OWNER/ADMIN/MEMBER) |
| Update | OWNER, ADMIN |
| Delete | OWNER |

Workspace yang tidak diikuti user → 404 `WORKSPACE_NOT_FOUND`.

---

## 5. Workspace Membership

### 5.1 Tujuan

Mengelola siapa saja yang boleh mengakses workspace dan dengan role apa.

### 5.2 Tanggung Jawab

- Menambah member lewat penerimaan undangan.
- Menampilkan daftar member.
- Mengubah role member.
- Menghapus member.
- Melindungi owner dari penghapusan/demosi ilegal.
- Menjadi sumber kebenaran otorisasi workspace.

### 5.3 Fitur

- List member (dengan cursor pagination).
- Update role (`ADMIN` ↔ `MEMBER`; OWNER tidak dapat diubah lewat endpoint ini).
- Remove member (OWNER/ADMIN sesuai aturan).
- (Internal) `RequireMember`, `RequirePermission`.

### 5.4 Hubungan

| Domain | Hubungan |
|---|---|
| Workspace | Member selalu milik satu workspace |
| Invitation | Penerimaan undangan membuat baris member |
| Task | Assignee harus member workspace |
| Authorization | Sumber data permission matrix |

### 5.5 Entitas

- `workspace_members`: `id`, `workspace_id`, `user_id`, `role`, `joined_at`, `created_at`,
  `updated_at`.
- Unique: `(workspace_id, user_id)`.
- Partial unique: satu `OWNER` per workspace (`WHERE role = 'OWNER'`).

### 5.6 Endpoint

| Method | Path |
|---|---|
| GET | `/api/v1/workspaces/{workspace_id}/members` |
| PATCH | `/api/v1/workspaces/{workspace_id}/members/{user_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}/members/{user_id}` |

### 5.7 Business Logic

- Role valid: `OWNER`, `ADMIN`, `MEMBER`.
- Setiap workspace memiliki tepat satu OWNER (dijaga partial unique index).
- OWNER tidak dapat dihapus lewat `DELETE member`; harus transfer ownership (tidak termasuk
  Phase 0, lihat catatan).
- OWNER tidak dapat diturunkan role-nya lewat endpoint update role.
- ADMIN tidak dapat mengubah role OWNER atau mengangkat member menjadi OWNER.
- ADMIN tidak dapat mengubah role ADMIN lain? **Keputusan:** ADMIN boleh mengubah role MEMBER
  ↔ ADMIN, tetapi tidak boleh mengubah/menghapus ADMIN lain. Ini mencegah perang admin.
- Member dapat menghapus dirinya sendiri (leave workspace) lewat endpoint remove dengan
  `user_id` = dirinya, kecuali OWNER.
- Menghapus member tidak menghapus task yang dibuat/di-assign; `created_by`/`assignee_id`
  dipertahankan. Task dengan assignee yang sudah keluar tetap ada dan ditandai di response
  (`assignee_is_member=false`) pada Phase 4.
- Remove member yang tidak ada di workspace → 404 `MEMBER_NOT_FOUND`.
- Remove member terakhir (OWNER) → 409 `OWNER_PROTECTED`.

### 5.8 Authorization

| Aksi | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| List member | ✅ | ✅ | ✅ |
| Update role MEMBER→ADMIN | ✅ | ✅ | ❌ |
| Update role ADMIN→MEMBER | ✅ | ❌ | ❌ |
| Remove MEMBER | ✅ | ✅ | ❌ |
| Remove ADMIN | ✅ | ❌ | ❌ |
| Remove diri sendiri | ❌ (owner) | ✅ | ✅ |
| Remove OWNER | ❌ | ❌ | ❌ |

---

## 6. Workspace Invitation

### 6.1 Tujuan

Mengundang pengguna lain bergabung ke workspace melalui email dengan token satu kali pakai.

### 6.2 Tanggung Jawab

- Membuat undangan dengan token acak dan masa berlaku.
- Mengirim email undangan (SMTP atau logger adapter).
- Memvalidasi token saat diterima.
- Mencegah undangan duplikat untuk email yang sama pada workspace yang sama.
- Menangani status undangan: `PENDING`, `ACCEPTED`, `CANCELLED`, `EXPIRED`.

### 6.3 Fitur

- Create invitation.
- List invitation (workspace).
- Cancel invitation.
- Accept invitation (oleh user terautentikasi dengan email yang cocok).
- (Internal) penandaan `EXPIRED` saat dibaca/diproses.

### 6.4 Hubungan

| Domain | Hubungan |
|---|---|
| Workspace | Undangan milik satu workspace |
| Membership | Accept membuat member baru |
| User Management | Validasi email; user harus terdaftar untuk accept |
| Mailer | Pengiriman email setelah commit |
| Notification | (Opsional) notifikasi in-app saat undangan dibuat/diterima |

### 6.5 Entitas

- `workspace_invitations`: `id`, `workspace_id`, `invited_by`, `email`, `role`, `token_hash`,
  `status`, `expires_at`, `accepted_at`, `created_at`, `updated_at`.
- Unique `token_hash`.
- Partial unique `(workspace_id, lower(email)) WHERE status = 'PENDING'`.
- Index `(workspace_id, created_at DESC, id DESC)`.

> Catatan: field `role` ditambahkan pada baseline untuk menentukan role saat accept.
> Tanpa field ini, endpoint create invitation tidak dapat menentukan role tujuan.

### 6.6 Endpoint

| Method | Path |
|---|---|
| POST | `/api/v1/workspaces/{workspace_id}/invitations` |
| GET | `/api/v1/workspaces/{workspace_id}/invitations` |
| DELETE | `/api/v1/workspaces/{workspace_id}/invitations/{invitation_id}` |
| POST | `/api/v1/invitations/{token}/accept` |

### 6.7 Business Logic

- Email dinormalisasi lowercase.
- Tidak boleh mengundang email yang sudah menjadi member aktif → 409
  `ALREADY_MEMBER`.
- Tidak boleh ada dua undangan PENDING untuk email sama di workspace sama → 409
  `INVITATION_ALREADY_PENDING` (bisa ditawarkan resend di masa depan; Phase 0 tidak).
- Role yang dapat diundang: `ADMIN` atau `MEMBER`. Tidak boleh `OWNER`.
- Hanya OWNER/ADMIN yang dapat mengundang.
- ADMIN tidak boleh mengundang dengan role ADMIN? **Keputusan:** ADMIN boleh mengundang
  `MEMBER` saja; hanya OWNER yang boleh mengundang `ADMIN`. Alasan: mencegah eskalasi
  privilege oleh ADMIN.
- Token: 32 byte acak, dikirim mentah hanya di email; disimpan `sha256(token)`.
- Masa berlaku default 7 hari (`INVITATION_TTL`).
- Accept:
  1. Cari undangan berdasarkan hash token.
  2. Jika tidak ada → 404 `INVITATION_NOT_FOUND`.
  3. Jika status bukan PENDING → 409 `INVITATION_NOT_PENDING`.
  4. Jika `expires_at < now` → set EXPIRED, 410 `INVITATION_EXPIRED`.
  5. Email user yang login harus sama dengan `email` undangan → 403
     `INVITATION_EMAIL_MISMATCH`.
  6. Jika sudah member → 409 `ALREADY_MEMBER`.
  7. Buat member (role dari undangan) + set status ACCEPTED + `accepted_at` dalam satu tx.
- Cancel: hanya undangan PENDING; set `CANCELLED`. Undangan ACCEPTED tidak dapat dibatalkan.
- Undangan tidak dihapus hard agar histori tetap ada.
- Email dikirim **setelah transaksi commit**. Jika pengiriman gagal, undangan tetap ada dengan
  `email_delivery_status = 'FAILED'` (kolom tambahan) dan dapat di-resend secara manual
  (Phase 3 opsional). Kegagalan email tidak menggagalkan pembuatan undangan.

### 6.8 Authorization

| Aksi | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Create (role MEMBER) | ✅ | ✅ | ❌ |
| Create (role ADMIN) | ✅ | ❌ | ❌ |
| List | ✅ | ✅ | ✅ |
| Cancel | ✅ | ✅ | ❌ |
| Accept | Hanya user dengan email yang diundang | | |

---

## 7. Task Management

### 7.1 Tujuan

Menyediakan unit pekerjaan utama di dalam workspace, termasuk status, prioritas, due date,
assignee, tag, dan label.

### 7.2 Tanggung Jawab

- CRUD task.
- Transisi status (complete/reopen).
- Validasi assignee adalah member workspace.
- Validasi tag/label berasal dari workspace yang sama.
- Menjaga integritas `workspace_id` pada semua operasi.

### 7.3 Fitur

- Create, list, get, update, delete (soft delete).
- Complete dan reopen.
- Assign/unassign assignee.
- Set/clear due date.
- Lampirkan tag dan label saat create/update.
- List dengan filter, sorting, dan cursor.

### 7.4 Hubungan

| Domain | Hubungan |
|---|---|
| Workspace | Task selalu milik satu workspace |
| Membership | Assignee harus member |
| Tag/Label | Relasi many-to-many dengan validasi workspace |
| Due Date | `due_at` menjadi dasar view dan reminder |
| Reminder | Reminder terikat task |
| Notification | Notifikasi dapat merujuk task |
| Pagination | List task memakai cursor |

### 7.5 Entitas

- `tasks`: `id`, `workspace_id`, `title`, `description`, `status`, `priority`, `due_at`,
  `completed_at`, `created_by`, `assignee_id`, `created_at`, `updated_at`, `deleted_at`.
- `task_tags`: `task_id`, `tag_id`, `workspace_id`.
- `task_labels`: `task_id`, `label_id`, `workspace_id`.

### 7.6 Endpoint

| Method | Path |
|---|---|
| POST | `/api/v1/workspaces/{workspace_id}/tasks` |
| GET | `/api/v1/workspaces/{workspace_id}/tasks` |
| GET | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}` |
| PATCH | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}` |
| POST | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/complete` |
| POST | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/reopen` |
| GET | `/api/v1/workspaces/{workspace_id}/tasks/views/today` |
| GET | `/api/v1/workspaces/{workspace_id}/tasks/views/upcoming` |
| GET | `/api/v1/workspaces/{workspace_id}/tasks/views/overdue` |

### 7.7 Business Logic

- `title`: 1–200 karakter, wajib.
- `description`: maksimal 10.000 karakter, opsional.
- `status`: `TODO`, `IN_PROGRESS`, `DONE`. Default `TODO`.
- `priority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. Default `MEDIUM`.
- `due_at`: opsional, ISO-8601 dengan offset atau `Z`; disimpan UTC.
- `completed_at` diisi saat status menjadi DONE; dikosongkan saat reopen.
- Complete task yang sudah DONE → idempoten (200, tidak mengubah `completed_at`).
- Reopen task yang belum DONE → idempoten (200).
- `assignee_id` harus member workspace; jika bukan → 422 `ASSIGNEE_NOT_MEMBER`.
- `tag_ids`/`label_ids` harus milik workspace yang sama; jika tidak → 422
  `INVALID_TAG`/`INVALID_LABEL`.
- Delete task = soft delete; reminder PENDING untuk task tersebut dibatalkan (status
  `CANCELLED`) dalam transaksi yang sama.
- Update task yang sudah di-soft-delete → 404.
- Task dari workspace lain tidak dapat diakses meski ID benar → 404.
- Task yang dibuat user yang kemudian keluar workspace tetap ada.

### 7.8 Authorization

| Aksi | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Create | ✅ | ✅ | ✅ |
| List/Read | ✅ | ✅ | ✅ |
| Update | ✅ | ✅ | ✅ |
| Delete | ✅ | ✅ | ✅ (hanya task yang ia buat? — **keputusan: semua task di workspace**) |
| Complete/Reopen | ✅ | ✅ | ✅ |

Keputusan: semua member dapat mengelola semua task di workspace. Pembatasan per-task
(mis. hanya creator) tidak diminta dan akan menyulitkan kolaborasi. Jika nanti dibutuhkan,
tambahkan aturan eksplisit.

---

## 8. Tag Management

### 8.1 Tujuan

Menyediakan kata kunci bebas (free-form) untuk mengelompokkan task dalam satu workspace.

### 8.2 Tanggung Jawab

- CRUD tag per workspace.
- Menjaga nama unik per workspace (case-insensitive).
- Menyediakan katalog ID valid untuk `tasks`.

### 8.3 Fitur

- Create, list, update, delete tag.
- Pemasangan tag ke task dilakukan lewat payload task (bukan endpoint terpisah pada Phase 0).

### 8.4 Hubungan

| Domain | Hubungan |
|---|---|
| Workspace | Tag milik satu workspace |
| Task | Many-to-many via `task_tags` |
| Authorization | Hanya member workspace |
| Pagination | List tag memakai cursor (opsional; dataset kecil) |

### 8.5 Entitas

- `tags`: `id`, `workspace_id`, `name`, `created_at`, `updated_at`.
- Unique `(workspace_id, lower(name))`.

### 8.6 Endpoint

| Method | Path |
|---|---|
| POST | `/api/v1/workspaces/{workspace_id}/tags` |
| GET | `/api/v1/workspaces/{workspace_id}/tags` |
| PATCH | `/api/v1/workspaces/{workspace_id}/tags/{tag_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}/tags/{tag_id}` |

### 8.7 Business Logic

- Nama 1–50 karakter, trim, collapse spasi.
- Case-insensitive unique: "Backend" dan "backend" dianggap sama.
- Delete tag hard delete dan otomatis menghapus baris pivot (`ON DELETE CASCADE`).
- Rename tag tidak mengubah relasi task.
- Tag tidak memiliki soft delete (tidak diminta; dataset kecil dan mudah dibuat ulang).
- Tag dari workspace lain tidak dapat di-update/delete → 404.

### 8.8 Authorization

| Aksi | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| CRUD | ✅ | ✅ | ✅ |

Semua member boleh mengelola taksonomi. Jika nanti perlu pembatasan, tambahkan permission
`MANAGE_TAXONOMY` khusus OWNER/ADMIN.

---

## 9. Label Management

### 9.1 Tujuan

Menyediakan kategori berwarna untuk klasifikasi visual task. Berbeda dari tag yang bebas,
label dimaksudkan sebagai dimensi terbatas (mis. "Bug", "Feature", "Design") dengan warna.

### 9.2 Tanggung Jawab

- CRUD label per workspace.
- Validasi format warna.
- Menjaga nama unik per workspace.
- Menyediakan katalog ID valid untuk `tasks`.

### 9.3 Fitur

- Create, list, update, delete label.
- Pemasangan label ke task lewat payload task.

### 9.4 Hubungan

Sama seperti Tag, dengan entitas `labels` dan pivot `task_labels`.

### 9.5 Entitas

- `labels`: `id`, `workspace_id`, `name`, `color`, `created_at`, `updated_at`.
- Unique `(workspace_id, lower(name))`.
- Check `color ~ '^#[0-9A-Fa-f]{6}$'`.

### 9.6 Endpoint

| Method | Path |
|---|---|
| POST | `/api/v1/workspaces/{workspace_id}/labels` |
| GET | `/api/v1/workspaces/{workspace_id}/labels` |
| PATCH | `/api/v1/workspaces/{workspace_id}/labels/{label_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}/labels/{label_id}` |

### 9.7 Business Logic

- Nama 1–50 karakter.
- `color` wajib, format `#RRGGBB` (uppercase dinormalisasi).
- Default color jika tidak dikirim? **Keputusan:** wajib, agar tidak ada label tanpa identitas
  visual.
- Delete label hard delete + cascade pivot.
- Label workspace lain → 404.

### 9.8 Authorization

Sama seperti Tag: semua member.

### 9.9 Catatan Perbedaan Tag vs Label

| Aspek | Tag | Label |
|---|---|---|
| Semantik | Kata kunci bebas, banyak | Kategori terbatas, visual |
| Warna | Tidak ada | Wajib |
| Jumlah per workspace | Banyak (puluhan) | Sedikit (belasan) |
| Filter | `tag_ids` (AND/OR) | `label_ids` (AND/OR) |
| UI | Chip netral | Chip berwarna |

Perbedaan ini dipertahankan agar model data tidak digabung; penggabungan akan menghilangkan
warna dan menyulitkan filter.

---

## 10. Due Date Management

### 10.1 Tujuan

Menyimpan tenggat waktu task secara konsisten dalam UTC dan menafsirkannya sesuai timezone
user untuk view harian.

### 10.2 Tanggung Jawab

- Validasi dan normalisasi input waktu.
- Menyimpan UTC.
- Menyediakan dasar perhitungan Today/Upcoming/Overdue.
- Menjaga konsistensi `completed_at` dan `status`.

### 10.3 Fitur

- Set/clear `due_at` saat create/update.
- Perhitungan rentang hari lokal.
- Penanda overdue.

### 10.4 Hubungan

| Domain | Hubungan |
|---|---|
| Task | `tasks.due_at` |
| Timezone | Batas hari dihitung dengan timezone user |
| Reminder | Reminder biasanya relatif terhadap due date |
| Notification | Notifikasi due soon/overdue |
| Cursor Pagination | Sorting berdasarkan `due_at` |

### 10.5 Entitas

Tidak ada tabel khusus; menggunakan `tasks.due_at`, `tasks.completed_at`, `users.timezone`.

### 10.6 Endpoint

Tidak ada endpoint khusus. Due date diatur lewat create/update task dan dibaca lewat view.

### 10.7 Business Logic

- Input harus RFC3339 dengan timezone/offset. Input tanpa offset ditolak (ambigu).
- Disimpan sebagai `timestamptz` (UTC).
- `due_at` boleh di masa lalu saat create (mis. backlog); tidak ada larangan.
- Task dianggap selesai hanya jika `status = DONE`; `completed_at` adalah metadata.
- Overdue = `due_at < now()` AND `status <> 'DONE'` AND `deleted_at IS NULL`.
- Today = `due_at` berada di `[start_of_local_day_utc, end_of_local_day_utc)`.
- Upcoming = `due_at >= end_of_local_day_utc` AND `due_at < start_of_local_day_utc + N days`.
- Batas hari dihitung di Go dengan `time.Date(..., loc)` agar DST-safe.
- Untuk task tanpa due date, tidak muncul di Today/Upcoming/Overdue.

### 10.8 Authorization

Mengikuti authorization task: semua member workspace dapat melihat/mengubah due date.

---

## 11. Task Filtering

### 11.1 Tujuan

Memungkinkan client mempersempit daftar task tanpa mengambil seluruh dataset, dan menjaga
hasil tetap deterministik saat dipadukan dengan cursor pagination.

### 11.2 Tanggung Jawab

- Mendefinisikan parameter filter yang didukung.
- Memvalidasi kombinasi filter.
- Menerjemahkan filter menjadi query SQL yang aman (parameterized).
- Menjaga index yang mendukung filter utama.

### 11.3 Fitur

Filter yang didukung pada list task:

| Parameter | Tipe | Semantik |
|---|---|---|
| `status` | CSV enum | `TODO,IN_PROGRESS,DONE` (OR) |
| `priority` | CSV enum | `LOW,MEDIUM,HIGH,URGENT` (OR) |
| `assignee_id` | UUID / `me` / `none` | Filter assignee |
| `tag_ids` | CSV UUID | Task yang memiliki **semua** tag (AND) |
| `label_ids` | CSV UUID | Task yang memiliki **semua** label (AND) |
| `due_from` | RFC3339 | `due_at >=` |
| `due_to` | RFC3339 | `due_at <=` |
| `q` | string | Judul/deskripsi contains (ILIKE), maks 100 char |
| `include_completed` | bool | Default `true` untuk list umum; view Today default `false` |
| `sort` | enum | `created_at`, `updated_at`, `due_at`, `priority`, `title` |
| `order` | enum | `asc`/`desc` |
| `limit` | int | 1–100, default 20 |
| `cursor` | string | Opaque cursor |

### 11.4 Hubungan

| Domain | Hubungan |
|---|---|
| Cursor Pagination | Filter harus konsisten antar halaman |
| Task | Sumber data |
| Tag/Label | Filter many-to-many |
| Index Strategy | Filter utama harus punya index |

### 11.5 Entitas

Menggunakan `tasks`, `task_tags`, `task_labels`.

### 11.6 Endpoint

`GET /api/v1/workspaces/{workspace_id}/tasks` dengan query parameter di atas.
View Today/Upcoming/Overdue memakai subset filter (status, priority, assignee, tag, label, q).

### 11.7 Business Logic

- Semua filter bersifat **AND** antar kategori, **OR** di dalam kategori yang sama.
- `tag_ids`/`label_ids` memakai AND (task harus punya semua ID yang diminta). Alasan: lebih
  intuitif untuk persempit; OR dapat ditambahkan lewat parameter `tag_mode=any` di masa depan
  (tidak di Phase 0).
- ID tag/label yang bukan milik workspace diabaikan? **Keputusan:** kembalikan 422
  `INVALID_FILTER` agar client mengetahui kesalahan. Ini mencegah hasil kosong yang membingungkan.
- `due_from > due_to` → 422.
- `q` di-escape untuk `%` dan `_`; memakai `ILIKE '%' || ? || '%'`.
- Filter di-encode ke dalam cursor (hash) agar tidak berubah antar halaman.
- `include_completed=false` menambahkan `status <> 'DONE'`.
- Default sort list: `created_at DESC, id DESC`.
- Default sort view due date: `due_at ASC, id ASC` (NULLS LAST tidak relevan karena view
  mewajibkan due_at).

### 11.8 Authorization

Semua filter hanya berlaku di dalam workspace yang user ikuti. Tidak ada filter lintas
workspace.

---

## 12. Cursor Pagination

### 12.1 Tujuan

Menyediakan pagination stabil untuk infinite scroll tanpa degradasi performa seperti offset.

### 12.2 Tanggung Jawab

- Format cursor opaque dan tervalidasi.
- Menjaga determinisme urutan.
- Menangani data baru/berubah selama scrolling.
- Menyediakan parameter `limit`/`cursor` yang konsisten.

### 12.3 Fitur

- Cursor berbasis keyset.
- Default limit 20, maksimum 100.
- Signing HMAC untuk mencegah tampering.
- Cursor menyimpan konteks sorting dan filter (hash).
- Berlaku untuk task, notification, member, invitation.

### 12.4 Hubungan

| Domain | Hubungan |
|---|---|
| Task Filtering | Cursor mengikat filter |
| Index Strategy | Keyset butuh composite index |
| API Convention | Format response `pagination` |

### 12.5 Entitas

Tidak ada tabel. Cursor adalah nilai turunan dari kolom sorting + `id`.

### 12.6 Endpoint

Semua endpoint list: tasks, notifications, members, invitations, tags (opsional).

### 12.7 Business Logic

Lihat dokumen lengkap: [`../api/cursor-pagination.md`](../api/cursor-pagination.md).

Ringkas:
- Cursor = `base64url(payload) + "." + base64url(hmac)`.
- Payload: `v`, `sort`, `order`, `filter_hash`, `k` (nilai kolom sort), `id`.
- Query: `WHERE (sort_col, id) > (k, id)` untuk ASC, atau `<` untuk DESC, dengan
  `NULLS LAST` untuk `due_at`.
- Data baru dengan nilai sort lebih besar tidak muncul di halaman berikutnya (konsisten).
- Data yang diubah nilainya dapat berpindah posisi; ini keterbatasan keyset yang
  didokumentasikan. Untuk task, perubahan `updated_at` tidak memakai `updated_at` sebagai
  default sort, sehingga dampaknya minimal.

### 12.8 Authorization

Cursor tidak mengandung otorisasi; setiap request tetap memvalidasi membership dan filter
`workspace_id`. Cursor yang dimanipulasi ditolak (signature invalid → 400 `INVALID_CURSOR`).

---

## 13. Reminder Management

### 13.1 Tujuan

Memungkinkan user menjadwalkan pengingat untuk task, yang nantinya diproses worker menjadi
notifikasi.

### 13.2 Tanggung Jawab

- CRUD reminder.
- Validasi waktu dan kepemilikan task.
- Menyediakan data bagi worker.
- Mencegah reminder ganda yang tidak disengaja (opsional, lihat aturan).

### 13.3 Fitur

- Create reminder (`scheduled_at` absolut).
- List reminder per task.
- Update `scheduled_at` (hanya jika belum SENT).
- Delete reminder.
- Status: `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`.

### 13.4 Hubungan

| Domain | Hubungan |
|---|---|
| Task | Reminder selalu terikat satu task |
| Workspace | Workspace diwarisi dari task; disimpan eksplisit untuk query |
| Worker | Memproses reminder PENDING |
| Notification | Worker membuat notifikasi |

### 13.5 Entitas

- `reminders`: `id`, `workspace_id`, `task_id`, `user_id`, `scheduled_at`, `status`,
  `sent_at`, `attempts`, `last_error`, `created_at`, `updated_at`.
- Index partial `(scheduled_at) WHERE status = 'PENDING'`.

> Field `workspace_id` dan `user_id` ditambahkan dari baseline. `workspace_id` memungkinkan
> filter/otorisasi tanpa join; `user_id` menentukan penerima notifikasi (default assignee,
> fallback creator) dan dibuat eksplisit agar worker tidak perlu menebak.

### 13.6 Endpoint

| Method | Path |
|---|---|
| POST | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders` |
| GET | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders` |
| PATCH | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders/{reminder_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders/{reminder_id}` |

### 13.7 Business Logic

- `scheduled_at` wajib RFC3339 dengan offset; disimpan UTC.
- Saat create, `scheduled_at` harus > now + 1 menit (mencegah reminder yang langsung
  terpicu). Jika tidak → 422 `REMINDER_IN_PAST`.
- `user_id` default: assignee task; jika tidak ada, `created_by`. Client tidak boleh
  menentukan penerima pada Phase 0.
- Maksimal 5 reminder PENDING per task (mencegah spam). → 422 `REMINDER_LIMIT_EXCEEDED`.
- Update hanya boleh mengubah `scheduled_at` dan hanya jika status `PENDING` atau `FAILED`.
- Reminder `SENT`/`CANCELLED` tidak dapat diubah/dihapus (delete SENT → 409).
- Delete reminder PENDING → hard delete.
- Task dihapus → semua reminder PENDING-nya di-`CANCELLED` (bukan hard delete) agar worker
  tidak memproses.
- Workspace dihapus → semua reminder PENDING/FAILED di workspace tersebut di-`CANCELLED`
  dalam transaksi delete workspace. Worker juga memeriksa status workspace sebelum membuat
  notifikasi.
- Reminder untuk task DONE tetap boleh dibuat (mis. follow-up), tetapi worker melewati
  reminder task DONE dan menandainya `CANCELLED` dengan `last_error='task_completed'`.

### 13.8 Authorization

Semua member workspace dapat CRUD reminder untuk task di workspace tersebut. Tidak ada
konsep "hanya pembuat reminder".

---

## 14. Notification Management

### 14.1 Tujuan

Menyimpan dan menyajikan notifikasi in-app kepada user, serta mencegah duplikasi.

### 14.2 Tanggung Jawab

- Inbox notifikasi per user.
- Mark read satu / semua.
- Deduplikasi berbasis `dedupe_key`.
- Menyimpan snapshot judul/pesan (tidak bergantung pada task yang mungkin berubah).
- (Opsional) pengiriman email.

### 14.3 Fitur

- List notifikasi (cursor, filter unread).
- Mark read.
- Read all.
- Jenis: `TASK_DUE_SOON`, `TASK_OVERDUE`, `REMINDER`, `WORKSPACE_INVITATION`,
  `INVITATION_ACCEPTED`.

### 14.4 Hubungan

| Domain | Hubungan |
|---|---|
| Reminder | Sumber notifikasi `REMINDER` |
| Task | Sumber due soon/overdue |
| Workspace | Konteks notifikasi |
| User | Penerima |
| Worker | Pembuat notifikasi |

### 14.5 Entitas

- `notifications`: `id`, `user_id`, `workspace_id`, `task_id`, `type`, `title`, `message`,
  `dedupe_key`, `read_at`, `created_at`.
- Unique `dedupe_key`.
- Partial index `(user_id, created_at DESC, id DESC) WHERE read_at IS NULL`.

### 14.6 Endpoint

| Method | Path |
|---|---|
| GET | `/api/v1/notifications` |
| PATCH | `/api/v1/notifications/{notification_id}/read` |
| POST | `/api/v1/notifications/read-all` |

### 14.7 Business Logic

- List hanya notifikasi milik user yang login; tidak ada akses lintas user.
- Filter opsional `unread=true`, `workspace_id`, `type`.
- Mark read idempoten; jika sudah read tetap 200.
- Mark read notifikasi user lain → 404 `NOTIFICATION_NOT_FOUND` (bukan 403, agar tidak
  membocorkan).
- `read-all` menandai semua notifikasi user; opsional `workspace_id`.
- `dedupe_key` dibentuk deterministik, mis.:
  - `reminder:{reminder_id}`
  - `task_due_soon:{task_id}:{due_at_unix}`
  - `task_overdue:{task_id}:{local_date}`
  - `invitation:{invitation_id}:{user_id}`
- `title`/`message` adalah snapshot; perubahan task tidak mengubah notifikasi lama.
- Retensi: tidak ada penghapusan otomatis pada Phase 0. Notifikasi lama tetap ada (dengan
  index yang mendukung). Kebijakan retensi masuk backlog operasional.

### 14.8 Authorization

- Hanya pemilik notifikasi.
- Tidak ada endpoint admin.
- Notifikasi yang merujuk workspace yang sudah dihapus tetap dapat dibaca (histori), tetapi
  link ke workspace akan 404 di frontend.

---

## 15. Background Worker

### 15.1 Tujuan

Memproses reminder jatuh tempo dan notifikasi turunannya secara otomatis di dalam proses
aplikasi, tanpa layanan terpisah.

### 15.2 Tanggung Jawab

- Polling reminder PENDING secara periodik.
- Locking aman untuk multi-instance.
- Membuat notifikasi idempoten.
- Menandai hasil (SENT/FAILED) dan retry.
- Berhenti dengan graceful saat shutdown.

### 15.3 Fitur

- Ticker interval dari env (`WORKER_INTERVAL`, default 30s).
- Batch size dari env (`WORKER_BATCH_SIZE`, default 50).
- `FOR UPDATE SKIP LOCKED`.
- Retry dengan `attempts` dan `last_error`.
- Graceful shutdown dengan timeout.
- (Opsional) advisory lock untuk memastikan satu runner.

### 15.4 Hubungan

| Domain | Hubungan |
|---|---|
| Reminder | Sumber job |
| Notification | Tujuan pembuatan |
| Task | Data untuk pesan dan status |
| Docker | Lifecycle container |

### 15.5 Entitas

- `reminders` (job source).
- `notifications` (hasil).
- Tidak memerlukan tabel job terpisah pada Phase 0; reminder adalah job table.

### 15.6 Endpoint

Tidak ada endpoint publik. Health/ready mencerminkan status worker secara loose (worker
failure tidak membuat readiness gagal pada Phase 0, tetapi dicatat di log/metric).
Keputusan: `/ready` hanya mengecek DB agar tidak memicu restart loop akibat worker.

### 15.7 Business Logic

Lihat [`notification-worker.md`](notification-worker.md).

### 15.8 Authorization

Worker berjalan dengan kredensial database aplikasi, bukan atas nama user. Semua operasi
memakai filter workspace/user yang tersimpan di reminder.

---

## 16. Docker & Deployment

### 16.1 Tujuan

Menyediakan cara konsisten untuk menjalankan aplikasi di development, test, staging, dan
production.

### 16.2 Tanggung Jawab

- Image build multi-stage.
- Compose untuk development (hot reload) dan production-like.
- Konfigurasi via environment.
- Migrasi database yang terkontrol.
- Health check dan graceful shutdown.

### 16.3 Fitur

- `docker-compose.yml` + override dev/prod.
- PostgreSQL dengan volume persisten.
- Non-root runtime.
- `.dockerignore` untuk mengecilkan konteks build.
- Secret tidak masuk image.

### 16.4 Hubungan

| Domain | Hubungan |
|---|---|
| Config | Env dibaca saat runtime |
| Migration | Dijalankan sebagai langkah deploy |
| Worker | Dijalankan dalam container yang sama |
| Observability | Log ke stdout |

### 16.5 Entitas

Tidak ada. Volume: `postgres_data`.

### 16.6 Endpoint

`GET /health`, `GET /ready` dipakai health check container/load balancer.

### 16.7 Business Logic

- Development: bind mount source, hot reload (Air), migration otomatis saat start dev.
- Test: image/step terpisah, DB test ephemeral.
- Production: image final tanpa compiler, non-root, read-only root filesystem bila
  memungkinkan, `GOMAXPROCS` mengikuti limit container.
- Migration production dijalankan sebagai job/step terpisah sebelum rollout, bukan otomatis
  oleh setiap replika.

### 16.8 Authorization

Tidak relevan untuk domain ini; akses ke container diatur oleh platform deployment.

---

## 17. Pemetaan Domain → Module

| Domain | Module utama | Module pendukung |
|---|---|---|
| Authentication & Authorization | `auth` | `users`, `workspaces` |
| User Management | `users` | — |
| Workspace Management | `workspaces` | `users` |
| Workspace Membership | `workspaces` | `users` |
| Workspace Invitation | `workspaces` | `users`, `shared/mailer` |
| Task Management | `tasks` | `workspaces`, `tags`, `labels` |
| Tag Management | `tags` | `workspaces` |
| Label Management | `labels` | `workspaces` |
| Due Date | `tasks` + `users` (timezone) | — |
| Task Filtering | `tasks` | — |
| Cursor Pagination | `shared/pagination` | `tasks`, `notifications`, `workspaces` |
| Reminder | `reminders` | `tasks`, `notifications` |
| Notification | `notifications` | `users` |
| Background Worker | `reminders` (runner) | `notifications` |
| Docker & Deployment | infrastruktur | semua |

## 18. Traceability Requirement → Dokumen

| Requirement | Dokumen |
|---|---|
| Struktur module | `modular-monolith.md`, `project-structure.md` |
| Database | `database/database-design.md`, `entity-relationship.md` |
| Migration | `database/migrations.md` |
| Auth | `authentication-flow.md` |
| Workspace RBAC | `workspace-authorization.md` |
| API | `api/endpoint-planning.md` |
| Pagination | `api/cursor-pagination.md` |
| Timezone | `timezone-handling.md` |
| Worker | `notification-worker.md` |
| Docker | `development/docker-development.md`, `deployment/docker-production.md` |
| Testing | `development/testing-strategy.md` |
| Roadmap | `implementation-roadmap.md` |
