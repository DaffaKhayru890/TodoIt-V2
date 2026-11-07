# Tracing

OpenTelemetry tidak dipasang. Kompatibilitas SDK dengan Bun pada jalur HTTP, Drizzle, dan Nodemailer tidak diverifikasi di fase ini, jadi tracing tidak diaktifkan setengah jalan.

`x-request-id` tetap menghubungkan log HTTP. Job yang lahir dari scheduler tidak membawa request id karena tidak berasal dari satu request.
