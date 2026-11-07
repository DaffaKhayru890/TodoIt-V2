# Penjadwalan Notifikasi

Scheduler adalah `NotificationReconciliation`. Ia membaca database secara berkala, default setiap 60 detik, lalu melakukan upsert job berdasarkan idempotency key yang stabil. Waktu saat polling tidak menjadi bagian key.

## Reminder absolute

`effectiveAt = reminder.remindAt`. Key job: `reminder:{reminderId}:{effectiveAt ISO UTC}`.

## Reminder before due

`effectiveAt = todo.dueAt - offsetMinutes`, memakai `computeReminderEffectiveAt`. Bila due date berubah, key baru berbeda dari key lama. Job pending dengan jadwal lama dibatalkan oleh `cancelStale` karena effective time sumber tidak lagi cocok.

## Due soon

Offset default `1440,60` menit, diurutkan menanjak setelah parsing. Untuk setiap offset:

`scheduledAt = todo.dueAt - offsetMinutes`

Key: `todo-due-soon:{todoId}:{dueAt ISO}:{offsetMinutes}`.

Bila todo dibuat setelah `scheduledAt` tetapi `dueAt` masih di masa depan, `availableAt` diset ke waktu sekarang. Bila `dueAt` sudah lewat, due-soon tidak dijadwalkan. Tampilan Overdue Phase 3 tidak berubah.

## Kelayakan sumber

Due-soon hanya untuk todo yang punya `dueAt`, status `todo` atau `in_progress`, belum dihapus, workspace aktif, dan pembuat masih anggota.

Reminder hanya yang statusnya `scheduled`, todo masih aktif, workspace aktif, dan pembuat masih anggota.

Query membatasi horizon `now + lookaheadDays + offset maksimum` dan memakai halaman, bukan memuat seluruh tabel. Default lookahead 90 hari. Konfigurasi ditolak bila lookahead lebih pendek dari offset terbesar, karena jadwal itu tidak akan pernah masuk jendela.

## Perubahan lifecycle

Saat job benar-benar diproses, dispatcher membaca ulang todo, reminder, workspace, dan keanggotaan. Pembatalan job pending bukan satu-satunya pengaman.

Todo selesai, dibatalkan, dihapus, due date dihapus, atau workspace diarsipkan membuat job due-soon tidak menghasilkan notification. Reminder `cancelled` juga tidak diproses.

## Reopen

Todo yang dibuka kembali dapat menjadwalkan due-soon bila masih memenuhi syarat. Key yang sama dengan notification yang sudah pernah dibuat tidak membuat baris kedua karena unique `idempotency_key`. Due date baru menghasilkan key baru.
