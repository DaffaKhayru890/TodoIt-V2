# Dokumentasi OpenAPI

Dokumen ini menjelaskan setup OpenAPI, cara mengakses dokumentasi interaktif, bentuk spesifikasi JSON yang dihasilkan, dan aturan menulis dokumentasi untuk endpoint baru.

## 1. Setup

Paket yang dipakai adalah `@elysia/openapi` versi 1.4.17 dengan provider **Scalar** — sesuai spesifikasi Phase 1. Plugin diregistrasi pada composition root lewat factory di [src/shared/presentation/http/plugins/openapi-documentation.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/presentation/http/plugins/openapi-documentation.ts):

```ts
openapi({
  path: '/openapi',
  specPath: '/openapi/json',
  provider: 'scalar',
  openapiVersion: '3.1.2',
  documentation: {
    info: { title: config.appName, version: config.appVersion, description: API_DESCRIPTION },
    servers,
    tags: API_TAGS
  },
  scalar: { title: `${config.appName} API`, theme: 'kepler' }
});
```

`info.title` dan `info.version` diambil dari `APP_NAME` / `APP_VERSION`, sehingga dokumen tidak pernah menyatakan versi yang berbeda dari aplikasi yang jalan. Deskripsi API secara eksplisit menyebut bahwa Phase 1 hanya menyediakan fondasi — dokumentasi tidak boleh mengaku fitur yang belum ada sudah selesai.

## 2. Endpoint dokumentasi

| URL | Isi |
| --- | --- |
| `GET /openapi` | HTML UI Scalar (interaktif: coba request, lihat schema) |
| `GET /openapi/json` | spesifikasi OpenAPI 3.1.2 format JSON |

```bash
curl -s http://127.0.0.1:4000/openapi | head -c 200     # <!doctype html> … Scalar
curl -s http://127.0.0.1:4000/openapi/json | jq '.openapi, .info, .paths | keys?'
```

## 3. Isi spesifikasi saat ini

Hasil verifikasi dari server development yang sedang berjalan:

```json
{
  "openapi": "3.1.2",
  "info": { "title": "Todo Backend", "version": "0.1.0" },
  "servers": [
    { "url": "http://localhost:4000", "description": "Instansi lokal development" },
    { "url": "/", "description": "Server tempat dokumentasi ini disajikan" }
  ],
  "tags": [
    { "name": "Health", "description": "Liveness dan readiness probe untuk orkestrasi container dan monitoring." },
    { "name": "Documentation", "description": "Akses dokumen OpenAPI (UI Scalar dan spesifikasi JSON)." }
  ],
  "paths": ["/health", "/ready"]
}
```

Yang perlu diketahui dari bentuk keluarannya:

- Schema dirender **inline** di dalam tiap response (`components.schemas` kosong). Ini perilaku `@elysia/openapi` 1.4.17 ketika schema dideklarasikan per-route, dan tidak masalah untuk klien karena setiap respons punya deskripsi lengkap.
- `operationId` diturunkan otomatis dari route (`getHealth`, `getReady`).
- `servers` berbeda menurut environment: development/test mendapat dua entri (localhost + server tempat dokumen disajikan), staging/production hanya `"/"` supaya dokumen tidak memuat host internal (lihat `createOpenApiPlugin`).

## 4. Endpoint Phase 1

### `GET /health`

- Tujuan: membuktikan proses HTTP hidup. Sengaja tidak menyentuh database agar tetap menjawab saat database bermasalah.
- Parameter: tidak ada (path, query, body).
- `200` → `{ "status": "ok" }`, skema `HealthResponse` dengan `examples: [{ ok: { status: "ok" } }]`.
- Tag: `Health`.

```bash
curl -i http://127.0.0.1:4000/health
# 200, x-request-id: <uuid>, access-control-allow-origin (bila CORS_ORIGINS diisi)
```

### `GET /ready`

- Tujuan: memastikan aplikasi siap menerima request; use case `CheckServiceReadiness` memanggil probe `SELECT 1` dengan batas waktu 1 detik.
- Parameter: tidak ada.
- `200` → `{ "status": "ready", "dependencies": { "database": "connected" } }`.
- `503` → sampul error dengan `code: "SERVICE_UNAVAILABLE"`.
- Tag: `Health`.

```bash
curl -s http://127.0.0.1:4000/ready
# {"status":"ready","dependencies":{"database":"connected"}}

# contoh respons galat (bentuknya sama untuk semua error API ini)
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Salah satu dependensi inti belum siap menerima request.",
    "requestId": "3c8a…"
  }
}
```

Host, port, user, nama database, dan password tidak pernah muncul di respons mana pun. Aturan ini dijaga oleh test `tests/unit/ready-endpoint.test.ts` dan `tests/integration/ready-endpoint.test.ts` yang mencari string internal di body respons.

## 5. Sampul error standar

Seluruh galat memakai satu bentuk (`ErrorResponse`, [src/shared/presentation/http/errors/error-response.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/presentation/http/errors/error-response.ts)):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Permintaan tidak lolos validasi skema.",
    "requestId": "3c8a…",
    "details": [{ "path": "body.title", "message": "Expected string" }]
  }
}
```

| Status | `code` | Pesan yang dikirim |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | `Body permintaan tidak dapat dibaca sebagai JSON yang valid.` |
| 404 | `NOT_FOUND` | `Endpoint yang diminta tidak tersedia.` |
| 422 | `VALIDATION_ERROR` | `Permintaan tidak lolos validasi skema.` + maksimal 10 `details` |
| 503 | `SERVICE_UNAVAILABLE` | `Salah satu dependensi inti belum siap menerima request.` |
| 500 | `INTERNAL_SERVER_ERROR` | `An unexpected error occurred` |

Pemetaannya ada di [src/shared/presentation/http/errors/error-handler.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/presentation/http/errors/error-handler.ts) dan dipasang terpusat lewat `onError` di [src/bootstrap/create-app.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/bootstrap/create-app.ts). `details` hanya berisi path dan pesan, tidak pernah berisi nilai input klien.

Setiap request — sukses maupun gagal — membawa `x-request-id` (dibuat dengan `crypto.randomUUID()` atau diteruskan dari header klien yang valid, lihat `ensureRequestId`). Header yang sama ikut disertakan pada body error sehingga satu insiden dapat dicocokkan dengan baris log JSON di server. Plugin CORS mengekspos header ini (`exposeHeaders`) agar pembacaan dari browser dimungkinkan.

## 6. Menambah dokumentasi endpoint baru

Dokumentasi bukan file terpisah: ia dihasilkan dari deklarasi route, sehingga tidak bisa tertinggal dari kode selama route ditulis dengan benar. Setiap route **wajib** mengisi sepuluh butir yang diminta spesifikasi Phase 1.

```ts
.get(
  '/todos',
  async ({ query, set, headers }) => {/* hanya menerjemahkan HTTP → use case */},
  {
    params: t.Object({ /* path parameter bila ada */ }),
    query: t.Object({ /* query parameter bila ada */ }),
    body: t.Object({ /* request body bila ada */ }),
    response: { 200: listTodosResponseSchema, 422: errorResponseSchema },
    detail: {
      summary: 'Daftar todo milik pengguna',                 // (1) tujuan
      description: [
        'Method: GET. URL: `/api/v1/todos`.',                 // (2)(3) method & URL
        'Path parameter: tidak ada.',                         // (4)
        'Query parameter: `status` — enum open/done.',        // (5)
        'Request body: tidak ada.',                           // (6)
        'Response 200 berisi array objek Todo.',              // (7)
        'Galat yang mungkin: 422 VALIDATION_ERROR, 401 (phase autentikasi).' // (8)
      ].join(' '),
      tags: ['Todos'],
      responses: {
        200: { description: 'Contoh body: `{ "data": [ … ] }`.' },   // (9)(10) contoh
        422: { description: 'Contoh body sampul error dengan details.' }
      }
    }
  }
)
```

Aturan yang berlaku:

1. Skema validasi dan skema dokumentasi harus objek yang sama (`t.*` dari TypeBox). Menulis `detail.schema` manual sebagai objek literal membuat dokumen bisa bohong.
2. Setiap skema respons diberi `title`, `description`, dan `examples`.
3. Setiap status code yang mungkin muncul — termasuk galat — didaftarkan di `response` dan `detail.responses`.
4. Tag baru wajib ditambahkan ke `API_TAGS` di `openapi-documentation.ts` agar Scalar menampilkan deskripsi tag, bukan hanya nama.
5. Endpoint bisnis dipasang di bawah prefix `/api/v1` lewat `registerModules`; `/health` dan `/ready` tetap di root karena dipakai probe orchestrator.
6. Tidak ada endpoint tanpa deskripsi. Kalimat minimal yang diterima: tujuan, method+URL, parameter, dan daftar galat.
7. Dokumentasi tidak boleh menyebut fitur yang belum diimplementasikan.

Test yang menjaga aturan ini ada di [tests/unit/openapi-documentation.test.ts](file:///home/daffakhayru/Applications/TodoIt-v2/tests/unit/openapi-documentation.test.ts) (UI tersedia, JSON dapat diakses, health & readiness terdaftar). Ketika menambah module, tambahkan assertion path baru di file tersebut.
