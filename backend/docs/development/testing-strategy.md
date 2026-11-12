# Development — Testing Strategy

## 1. Prinsip

1. **Test perilaku, bukan implementasi.** Fokus pada kontrak service/endpoint, bukan detail
   private.
2. **Database nyata untuk integrasi.** Jangan mengganti PostgreSQL dengan SQLite; perilaku
   constraint, locking, dan tipe data berbeda.
3. **Test cepat untuk unit, realistis untuk integrasi.** Unit test tidak menyentuh DB.
4. **Setiap endpoint punya test controller dan service.**
5. **Setiap aturan otorisasi diuji negatif** (bukan hanya happy path).
6. **Test harus deterministik.** Waktu, UUID, dan randomness diinjeksi.
7. **Test tidak boleh menyentuh database development/production.**

## 2. Piramida Test

```mermaid
flowchart TD
    U[Unit test<br/>cepat, banyak] --> S[Service test<br/>fake repository]
    S --> C[Controller test<br/>httptest + fake service]
    C --> I[Integration test<br/>PostgreSQL nyata]
    I --> E[End-to-end/contract<br/>sedikit]
```

| Lapis | Jumlah relatif | Kecepatan | Database |
|---|---|---|---|
| Unit domain/util | Banyak | < 1 ms | Tidak |
| Service | Banyak | < 5 ms | Tidak (fake) |
| Controller | Sedang | < 10 ms | Tidak (fake) |
| Repository | Sedang | 10–50 ms | Ya |
| Integration/API | Sedang | 50–500 ms | Ya |
| Worker/concurrency | Sedikit | 100 ms–2 s | Ya |

## 3. Tooling

| Tool | Fungsi |
|---|---|
| `testing` | Runner standar |
| `github.com/stretchr/testify/assert` | Assertion |
| `github.com/stretchr/testify/require` | Assertion yang menghentikan test |
| `github.com/stretchr/testify/suite` | Suite opsional untuk integration |
| `net/http/httptest` | Test handler HTTP |
| `github.com/google/uuid` | UUID test |
| `go.uber.org/mock` atau fake manual | Mock/fake |
| `github.com/jackc/pgx` (via GORM) | Driver DB |
| `go test -race` | Deteksi race |

Keputusan mock: **fake manual lebih diutamakan** untuk repository (map/in-memory) karena
lebih mudah dibaca dan tidak memerlukan codegen. Mock generator dipakai untuk port eksternal
(mailer) bila perlu.

## 4. Struktur File Test

```text
backend/
├── internal/
│   ├── auth/services/auth_service_test.go
│   ├── tasks/services/task_service_test.go
│   ├── tasks/controllers/task_controller_test.go
│   └── ...
├── tests/
│   ├── unit/
│   │   ├── architecture_test.go
│   │   ├── config_test.go
│   │   └── cursor_test.go
│   ├── integration/
│   │   ├── main_test.go          # setup DB, migrate, truncate
│   │   ├── auth_test.go
│   │   ├── workspace_test.go
│   │   ├── task_test.go
│   │   ├── pagination_test.go
│   │   ├── worker_test.go
│   │   └── security_test.go
│   └── fixtures/
│       ├── user.go
│       ├── workspace.go
│       └── task.go
```

Aturan:

- Unit test di sebelah file (`*_test.go`) untuk akses ke package internal.
- Integration test di `tests/integration` agar build tag/DB setup terpisah.
- Fixture di `tests/fixtures` agar tidak duplikasi.
- Nama file mengikuti resource.

## 5. Unit Test

### 5.1 Domain/Utility

Yang diuji:

- Validasi timezone, perhitungan hari lokal, DST.
- Cursor encode/decode/signature.
- Password policy.
- State transition task.
- Permission matrix (fungsi murni).
- Error mapping.

Contoh table-driven:

```go
func TestLocalDayRange(t *testing.T) {
    tests := []struct{
        name string
        now  time.Time
        tz   string
        wantStart string
        wantEnd   string
    }{
        {"jakarta", time.Date(2026,11,12,3,0,0,0,time.UTC), "Asia/Jakarta",
            "2026-11-11T17:00:00Z", "2026-11-12T17:00:00Z"},
        {"new york summer", time.Date(2026,7,15,12,0,0,0,time.UTC), "America/New_York",
            "2026-07-15T04:00:00Z", "2026-07-16T04:00:00Z"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            loc, _ := time.LoadLocation(tt.tz)
            got := LocalDayRange(tt.now, loc)
            require.Equal(t, tt.wantStart, got.StartUTC.Format(time.RFC3339))
            require.Equal(t, tt.wantEnd, got.EndUTC.Format(time.RFC3339))
        })
    }
}
```

### 5.2 Service

- Gunakan fake repository (in-memory map) dan fake `WorkspaceAccess`.
- Uji business logic, edge case, error propagation.
- Tidak menguji SQL.

Contoh daftar test service task:

| Test | Skenario |
|---|---|
| Create success | Input valid |
| Create invalid title | Error validasi |
| Create assignee bukan member | `ASSIGNEE_NOT_MEMBER` |
| Create tag workspace lain | `INVALID_TAG` |
| Update replace tags | Pivot diganti |
| Complete idempoten | Dua kali, `completed_at` tetap |
| Reopen dari TODO | Idempoten |
| Delete | Reminder dibatalkan |
| List filter | Query builder dipanggil dengan filter benar |
| Non-member | `ErrNotMember` |

### 5.3 Controller

- `httptest.NewRecorder` + Gin engine dengan route.
- Fake service (bukan DB).
- Uji status, body, header, validasi.
- Uji auth middleware terpasang/tidak.

Contoh:

```go
func TestCreateTask_ValidationError(t *testing.T) {
    svc := &fakeTaskService{}
    r := gin.New()
    RegisterRoutes(r.Group("/api/v1"), NewController(svc), fakeAuth())
    req := httptest.NewRequest(http.MethodPost, "/api/v1/workspaces/"+wsID+"/tasks", strings.NewReader(`{}`))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer test")
    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)
    require.Equal(t, http.StatusUnprocessableEntity, w.Code)
    // assert error.code == VALIDATION_ERROR
}
```

### 5.4 Test Nama

Format:

```text
Test<Subject>_<Scenario>_<Expected>
```

Contoh:

- `TestCreateTask_AssigneeNotMember_Returns422`
- `TestRefresh_ReusedToken_RevokesFamily`
- `TestListTasks_NonMember_Returns404`

## 6. Repository Test

- Menggunakan PostgreSQL nyata (test DB).
- Uji query, constraint, relasi, transaksi, locking.
- Tidak menguji HTTP.

Daftar wajib:

| Test | Fokus |
|---|---|
| Unique email | Duplikat ditolak |
| Session rotation | `replaced_by` benar |
| Partial unique owner | Dua owner gagal |
| Unique invitation pending | Duplikat gagal |
| Composite FK task_tags | Tag workspace lain gagal |
| Cascade delete tag | Pivot hilang |
| Soft delete task | Query tidak menemukan |
| Keyset pagination | Halaman tidak overlap |
| `FOR UPDATE SKIP LOCKED` | Dua transaksi tidak mengambil baris sama |
| Transaction rollback | Tidak ada partial write |

Contoh uji composite FK (penting):

```go
err := db.Exec(`INSERT INTO task_tags (task_id, tag_id, workspace_id) VALUES (?, ?, ?)`,
    taskInWS1, tagInWS2, ws1).Error
require.Error(t, err) // FK violation
```

## 7. Integration Test

### 7.1 Setup Database

Keputusan: memakai PostgreSQL container dan database `todolist_test` yang terpisah.

```go
func TestMain(m *testing.M) {
    dsn := os.Getenv("TEST_DATABASE_URL")
    if dsn == "" {
        log.Fatal("TEST_DATABASE_URL is required")
    }
    db = connect(dsn)          // GORM
    runMigrations(db)          // goose up
    code := m.Run()
    os.Exit(code)
}
```

Aturan:

- `TEST_DATABASE_URL` wajib; jika tidak ada, test gagal (bukan diam-diam memakai DB dev).
- Nama database harus berakhiran `_test`; helper memvalidasi dan menolak selain itu.
- Migrasi dijalankan sekali per suite.
- Tidak memakai `AutoMigrate`.
- Tidak ada data production.

### 7.2 Isolasi Antar Test

Dua strategi:

| Strategi | Kapan | Cara |
|---|---|---|
| Transaction rollback | Test yang tidak butuh multi-connection | Mulai tx, jalankan test, rollback |
| Truncate | Test worker/concurrency/HTTP yang memakai pool | `TRUNCATE ... RESTART IDENTITY CASCADE` |

Keputusan:

- Repository test: transaction rollback (cepat).
- Integration HTTP/worker: truncate sebelum test (deterministik).
- Truncate tidak menyentuh `goose_db_version`.

Helper:

```go
func TruncateAll(t *testing.T, db *gorm.DB) {
    t.Helper()
    tables := []string{"notifications","reminders","task_labels","task_tags",
        "labels","tags","tasks","workspace_invitations","workspace_members",
        "workspaces","user_sessions","users"}
    for _, tbl := range tables {
        require.NoError(t, db.Exec("TRUNCATE TABLE "+tbl+" CASCADE").Error)
    }
}
```

Nama tabel berasal dari daftar tetap (bukan input user) sehingga aman.

### 7.3 Test yang Wajib

| Area | Skenario |
|---|---|
| Auth | Register → login → access → refresh → logout |
| Refresh reuse | Token lama → family revoked |
| Workspace isolation | User B tidak dapat mengakses workspace A (404) |
| Role matrix | OWNER/ADMIN/MEMBER untuk setiap aksi |
| Task CRUD | Create/list/update/delete + pivot |
| Tag/label lintas workspace | 422 |
| Pagination | 3 halaman, tidak ada duplikat/hilang |
| Filter | status, priority, assignee, tag, label, q, due range |
| Today/Upcoming/Overdue | Timezone Jakarta & New York |
| Reminder worker | Due reminder → notification, idempoten |
| Workspace delete | Reminder PENDING/FAILED → `CANCELLED`; worker tidak membuat notifikasi |
| Worker concurrency | Dua worker paralel tidak duplikat |
| Worker crash | Insert lalu gagal update → retry tidak duplikat |
| Notification | Inbox hanya milik user, mark read |
| Health | `/ready` 503 saat DB mati |
| Migration | Up dari kosong, down, up lagi |

## 8. Test Worker dan Concurrency

### 8.1 Dua Worker Paralel

```go
func TestWorker_TwoInstances_NoDuplicate(t *testing.T) {
    seedReminder(t, db, time.Now().Add(-time.Minute))
    var wg sync.WaitGroup
    for i := 0; i < 2; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            worker := newTestWorker(db)
            worker.RunOnce(context.Background())
        }()
    }
    wg.Wait()
    require.Equal(t, 1, countNotifications(t, db))
    require.Equal(t, "SENT", reminderStatus(t, db))
}
```

### 8.2 Crash Simulation

- Buat fake `Notifier` yang insert lalu mengembalikan error.
- Worker menandai `FAILED`.
- Jalankan ulang; `dedupe_key` mencegah duplikat; reminder menjadi `SENT`.

### 8.3 Stale Lock

- Set reminder `PROCESSING` dengan `locked_at` lama.
- Jalankan recovery.
- Status kembali `PENDING`; diproses; hanya satu notifikasi.

## 9. Test Security

| Test | Ekspektasi |
|---|---|
| Tanpa token | 401 |
| Token expired | 401 `TOKEN_EXPIRED` |
| Token signature salah | 401 `INVALID_TOKEN` |
| Session revoked | 401 `SESSION_REVOKED` |
| IDOR workspace | 404 |
| IDOR task | 404 |
| IDOR notification | 404 |
| Role escalation | 403 |
| Owner removal | 409 |
| Rate limit login | 429 setelah N percobaan |
| Response tidak memuat hash/token | Assert |
| SQL injection di `q` | Tidak error, tidak bocor |
| Body > 1 MB | 413 |
| CORS origin tidak diizinkan | Header tidak ada |

## 10. Test Contract OpenAPI (Phase 7)

- Validasi YAML terhadap spec 3.0.3 (mis. `kin-openapi`).
- Bandingkan route Gin dengan path OpenAPI:
  - Semua route ada di spec.
  - Semua path spec ada di router.
- Test response schema untuk sample request.
- Test enum konsisten dengan konstanta Go.

## 11. Coverage

| Area | Target |
|---|---|
| `internal/shared` | ≥ 80% |
| Service module | ≥ 85% |
| Controller | ≥ 80% |
| Repository | ≥ 70% (integration) |
| Overall | ≥ 75% |

Coverage bukan tujuan akhir. Aturan:

- Jangan mengejar coverage dengan test tanpa assertion.
- Bagian yang sulit diuji (main wiring) dikecualikan dengan alasan.
- Coverage diukur per PR dan tidak boleh turun signifikan.

## 12. Test Data dan Fixture

### 12.1 Builder

```go
func NewUser(t *testing.T, db *gorm.DB, opts ...UserOption) User
func NewWorkspace(t *testing.T, db *gorm.DB, owner User, opts ...WorkspaceOption) Workspace
func NewTask(t *testing.T, db *gorm.DB, ws Workspace, opts ...TaskOption) Task
```

Aturan:

- Default valid; opsi untuk mengubah field.
- Mengembalikan struct dengan ID yang sudah tersimpan.
- Tidak memakai `random` tanpa seed; gunakan UUID deterministik jika perlu.
- Email unik per test (prefix + UUID).

### 12.2 Waktu

- Service menerima `Clock` interface.
- Test memakai `FixedClock{T: ...}`.
- Jangan memakai `time.Sleep` untuk menunggu; gunakan sinkronisasi/channel.
- Untuk worker, `RunOnce` disediakan agar test tidak menunggu ticker.

## 13. Menjalankan Test

```bash
# semua unit
go test ./... -short

# unit + race
go test ./... -race -count=1

# integration (butuh DB)
TEST_DATABASE_URL="postgres://root:dev%40123@localhost:5432/todolist_test?sslmode=disable" \
  go test ./tests/integration/... -race -count=1

# satu package
go test ./internal/tasks/services/... -run TestCreateTask -v
```

Build tag:

- Integration test memakai `//go:build integration` agar `go test ./...` tanpa DB tetap
  berjalan.
- CI menjalankan dua job: unit dan integration.

## 14. CI Pipeline (Phase 8)

```mermaid
flowchart LR
    A[Lint] --> B[Unit test]
    B --> C[Integration test]
    C --> D[Race]
    D --> E[Coverage]
    E --> F[OpenAPI validation]
    F --> G[Build image]
```

| Step | Perintah |
|---|---|
| Format | `gofmt -l .` (gagal jika ada output) |
| Vet | `go vet ./...` |
| Lint | `golangci-lint run` |
| Unit | `go test ./... -short -race` |
| Integration | `go test ./tests/integration/... -race` |
| Coverage | `go test ./... -coverprofile=coverage.out` |
| OpenAPI | `go test ./tests/unit/openapi_test.go` |
| Build | `docker build --target production` |

## 15. Anti-Pattern yang Dilarang

| Anti-pattern | Alasan |
|---|---|
| Test memakai database development | Merusak data |
| `AutoMigrate` di test | Tidak menguji migration nyata |
| `time.Sleep` untuk worker | Flaky/lambat |
| Mock seluruh repository untuk integration | Tidak menguji SQL |
| Assert hanya status 200 | Tidak memverifikasi kontrak |
| Test saling bergantung urutan | Tidak deterministik |
| Data global tanpa cleanup | Bocor antar test |
| Test menguji private method | Rapuh |
| Coverage tanpa assertion | Menyesatkan |
| SQLite untuk test | Perilaku constraint/locking berbeda |

## 16. Checklist per Endpoint

Setiap endpoint baru wajib memiliki:

- [ ] Test controller: sukses + validasi + auth + authz.
- [ ] Test service: happy path + minimal 2 edge case.
- [ ] Test repository jika ada query baru.
- [ ] Test integration jika menyentuh DB/constraint.
- [ ] Entri OpenAPI.
- [ ] Contoh response di dokumentasi.

## 17. Keputusan dan Trade-off

| Keputusan | Alasan | Alternatif |
|---|---|---|
| PostgreSQL nyata | Perilaku realistis | SQLite (tidak valid) |
| DB test terpisah | Isolasi | DB dev (berisiko) |
| Truncate + rollback | Cepat & deterministik | Recreate DB tiap test (lambat) |
| Fake manual untuk repository | Mudah dibaca | Mock codegen (verbose) |
| `-race` di CI | Deteksi race worker | Tanpa race (risiko) |
| Build tag integration | Unit test cepat | Semua test butuh DB |
| FixedClock | Deterministik | `time.Now()` (flaky) |
| OpenAPI contract test | Mencegah drift | Review manual |
| Coverage target moderat | Fokus perilaku | 100% (menyesatkan) |
