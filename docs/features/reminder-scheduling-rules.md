# Aturan Penjadwalan Reminder

## Absolute

`effectiveAt = remindAt`. `remindAt` wajib, harus ISO 8601 dengan timezone eksplisit, dan harus berada setelah `Clock.now()`. `offsetMinutes` tidak boleh ada.

## Before due

`effectiveAt = todo.dueAt - offsetMinutes`. Offset bilangan bulat 1 sampai 43200 (30 hari). Todo wajib punya `dueAt`. Effective time wajib di masa depan.

## Clock dan timezone

Waktu “sekarang” berasal dari `Clock`, bukan `new Date()` di use case. Production memakai `systemClock`. Test memakai `FixedClock` sehingga tidak ada menunggu waktu nyata.

Input klien membawa offset atau nama zona di string ISO. Nilai yang disimpan adalah `timestamptz` (instant UTC). Perhitungan offset memakai instant `dueAt` yang sudah tersimpan, bukan tanggal kalender lokal.

## Perubahan dueAt

Absolute tidak berubah. Before due dihitung ulang. Konflik menolak seluruh update Todo:

- `dueAt` null sementara reminder before_due masih scheduled;
- effective time hasil perubahan `<= now`.

User mengubah offset atau membatalkan reminder sebelum mengubah due date.

## Pembatalan lifecycle

Complete, cancel, dan soft delete Todo membatalkan seluruh reminder scheduled pada transaksi yang sama. Reopen tidak menjadwalkan ulang reminder lama.

## Konkurensi

1. `SELECT ... FOR UPDATE` pada baris Todo sebelum create reminder atau ubah dueAt.
2. Partial unique index menolak dua reminder scheduled dengan `remind_at` atau `offset_minutes` yang sama.
3. Unique index nama tag/label menolak dua create bersamaan; repository mengembalikan conflict 409.

## Notification Engine

Status `scheduled` adalah kontrak untuk fase pengiriman nanti. Fase ini tidak menambah status terkirim, tidak mencoba ulang, dan tidak memanggil penyedia email atau push.
