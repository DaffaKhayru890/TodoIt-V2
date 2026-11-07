# Mailpit untuk Development

Mailpit hanya ada di `compose.yaml` development. Image dipin `axllent/mailpit:v1.21.8`. Image production tidak menjalankan Mailpit.

```bash
docker compose up --build
```

| Kegunaan | Alamat |
|---|---|
| SMTP dari service backend | host `mailpit`, port `1025` |
| SMTP dari proses di host | `localhost:1025` |
| Antarmuka web | http://127.0.0.1:8025 |

Port UI dan SMTP di-bind ke `127.0.0.1`.

Di `.env.development` untuk proses di luar Compose:

```text
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=Todo Backend <noreply@localhost>
WEB_APP_URL=http://localhost:3000
```

Compose menimpa host SMTP menjadi `mailpit`.

Buka UI, buat undangan lewat API, lalu cari subjek `You have been invited to a Todo Workspace`. Tautan memuat token di fragment. Template ada di `src/modules/workspace/infrastructure/email/invitation-email.template.ts`.

Test otomatis memakai `FakeInvitationEmailSender` dan tidak membutuhkan Mailpit. Production memakai SMTP dari secret manager, dengan `SMTP_SECURE` sesuai penyedia dan `WEB_APP_URL` HTTPS.
