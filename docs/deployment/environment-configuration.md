# Environment deployment

Development dan test boleh memakai database lokal serta Mailpit. Staging dan production wajib HTTPS pada `WEB_APP_URL`, cookie Secure, `DATABASE_SSL=true`, user database khusus, password yang bukan `dev@123`, CORS eksplisit, dan SMTP yang bukan localhost.

Variabel baru fase 7 tercantum di `.env.production.example`. Nilai kosong pada secret contoh adalah placeholder, bukan secret sungguhan.
