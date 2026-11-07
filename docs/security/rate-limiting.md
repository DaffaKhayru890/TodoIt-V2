# Rate limiting

Production memakai `PostgresRateLimiter` pada tabel `rate_limit_windows`. Beberapa replika berbagi baris yang sama. Tidak ada Redis.

Kategori dan default per menit:

- auth: 20
- invitation: 30
- penulisan todo: 120
- notification: 240

Kunci adalah kategori, alamat klien, dan hash pendek header Authorization. Alamat klien hanya diambil dari `X-Forwarded-For` bila `TRUSTED_PROXY_HOPS` lebih dari nol. Selain itu kuncinya `direct`.

Respons 429 memakai kode `RATE_LIMITED` dan header `Retry-After`. Body yang `Content-Length`-nya melewati batas mendapat 413.
