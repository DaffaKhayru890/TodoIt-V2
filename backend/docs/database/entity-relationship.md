# Database — Entity Relationship Diagram

## 1. ERD Lengkap

```mermaid
erDiagram
    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar timezone
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    user_sessions {
        uuid id PK
        uuid user_id FK
        uuid family_id
        varchar refresh_token_hash UK
        varchar user_agent
        inet ip_address
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by_session_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    workspaces {
        uuid id PK
        varchar name
        text description
        uuid owner_id FK
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    workspace_members {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        varchar role
        timestamptz joined_at
        timestamptz created_at
        timestamptz updated_at
    }

    workspace_invitations {
        uuid id PK
        uuid workspace_id FK
        uuid invited_by FK
        varchar email
        varchar role
        varchar token_hash UK
        varchar status
        timestamptz expires_at
        timestamptz accepted_at
        varchar email_delivery_status
        timestamptz created_at
        timestamptz updated_at
    }

    tasks {
        uuid id PK
        uuid workspace_id FK
        varchar title
        text description
        varchar status
        varchar priority
        timestamptz due_at
        timestamptz completed_at
        uuid created_by FK
        uuid assignee_id FK
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    tags {
        uuid id PK
        uuid workspace_id FK
        varchar name
        timestamptz created_at
        timestamptz updated_at
    }

    labels {
        uuid id PK
        uuid workspace_id FK
        varchar name
        varchar color
        timestamptz created_at
        timestamptz updated_at
    }

    task_tags {
        uuid task_id PK
        uuid tag_id PK
        uuid workspace_id FK
        timestamptz created_at
    }

    task_labels {
        uuid task_id PK
        uuid label_id PK
        uuid workspace_id FK
        timestamptz created_at
    }

    reminders {
        uuid id PK
        uuid workspace_id FK
        uuid task_id FK
        uuid user_id FK
        timestamptz scheduled_at
        varchar status
        int attempts
        varchar last_error
        timestamptz next_attempt_at
        timestamptz locked_at
        timestamptz sent_at
        timestamptz created_at
        timestamptz updated_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        uuid workspace_id FK
        uuid task_id FK
        varchar type
        varchar title
        text message
        varchar dedupe_key UK
        timestamptz read_at
        timestamptz created_at
        timestamptz updated_at
    }

    users ||--o{ user_sessions : "memiliki"
    users ||--o| user_sessions : "menggantikan"
    users ||--o{ workspaces : "own"
    users ||--o{ workspace_members : "bergabung"
    users ||--o{ workspace_invitations : "mengundang"
    users ||--o{ tasks : "membuat"
    users ||--o{ tasks : "assignee"
    users ||--o{ reminders : "menerima"
    users ||--o{ notifications : "menerima"

    workspaces ||--o{ workspace_members : "memiliki"
    workspaces ||--o{ workspace_invitations : "memiliki"
    workspaces ||--o{ tasks : "memiliki"
    workspaces ||--o{ tags : "memiliki"
    workspaces ||--o{ labels : "memiliki"
    workspaces ||--o{ notifications : "konteks"

    tasks ||--o{ task_tags : "diberi"
    tags ||--o{ task_tags : "dipakai"
    tasks ||--o{ task_labels : "diberi"
    labels ||--o{ task_labels : "dipakai"
    tasks ||--o{ reminders : "memiliki"
    tasks ||--o{ notifications : "konteks"
```

> Catatan Mermaid: atribut `PK, FK` pada `task_tags.task_id` dan `task_labels.task_id`
> mewakili kunci komposit. Di database, composite foreign key mencakup
> `(task_id, workspace_id)` dan `(tag_id, workspace_id)`, bukan hanya kolom ID.

## 2. Kardinalitas dan Penjelasan Relasi

| Relasi | Kardinalitas | FK | On Delete | Penjelasan |
|---|---|---|---|---|
| users → user_sessions | 1:N | `user_id` | CASCADE | Satu user banyak device/session |
| user_sessions → user_sessions | 1:0..1 | `replaced_by_session_id` | SET NULL | Rantai rotasi refresh token |
| users → workspaces | 1:N | `owner_id` | RESTRICT | Satu user dapat memiliki banyak workspace |
| users ↔ workspaces (membership) | M:N via `workspace_members` | | CASCADE | User dapat menjadi member banyak workspace |
| users → workspace_invitations | 1:N | `invited_by` | RESTRICT | Undangan mencatat pengundang |
| workspaces → workspace_invitations | 1:N | `workspace_id` | CASCADE | Undangan milik satu workspace |
| workspaces → tasks | 1:N | `workspace_id` | CASCADE | Task selalu dalam satu workspace |
| users → tasks (creator) | 1:N | `created_by` | RESTRICT | Task mencatat pembuat |
| users → tasks (assignee) | 1:N | `assignee_id` | SET NULL | Assignee opsional |
| workspaces → tags | 1:N | `workspace_id` | CASCADE | Tag scoped workspace |
| workspaces → labels | 1:N | `workspace_id` | CASCADE | Label scoped workspace |
| tasks ↔ tags | M:N via `task_tags` | composite | CASCADE | Tag hanya dari workspace yang sama |
| tasks ↔ labels | M:N via `task_labels` | composite | CASCADE | Label hanya dari workspace yang sama |
| tasks → reminders | 1:N | `(task_id, workspace_id)` | CASCADE | Satu task banyak reminder |
| users → reminders | 1:N | `user_id` | CASCADE | Penerima reminder |
| users → notifications | 1:N | `user_id` | CASCADE | Inbox personal |
| workspaces → notifications | 1:N | `workspace_id` | SET NULL | Konteks opsional |
| tasks → notifications | 1:N | `task_id` | SET NULL | Konteks opsional |

## 3. Relasi Khusus: Workspace Scope

### 3.1 Mengapa `task_tags` Membawa `workspace_id`

```mermaid
erDiagram
    workspaces ||--o{ tasks : contains
    workspaces ||--o{ tags : contains
    tasks ||--o{ task_tags : links
    tags ||--o{ task_tags : links

    task_tags {
        uuid task_id PK
        uuid tag_id PK
        uuid workspace_id
    }
```

Database memiliki dua composite FK:

```text
(task_id,  workspace_id) -> tasks(id, workspace_id)
(tag_id,   workspace_id) -> tags(id,  workspace_id)
```

Jika service mencoba memasang tag dari workspace B ke task workspace A, salah satu FK akan
gagal karena `workspace_id` tidak dapat memenuhi keduanya sekaligus. Ini menjamin invariant
"tag dan task harus satu workspace" tanpa trigger.

### 3.2 Relasi yang Membutuhkan Validasi Service

| Invariant | Mengapa tidak bisa FK | Validasi |
|---|---|---|
| Assignee adalah member workspace | Membership bukan kolom task | `MemberIDs` |
| Creator adalah member saat create | Sama | `RequireMember` |
| Owner konsisten dengan membership OWNER | Dua tabel, circular jika FK ketat | Service + test |
| Penerima reminder adalah member | Sama | Saat create, penerima = assignee/creator yang sudah member |
| Notifikasi ditujukan ke user yang tepat | Worker bukan atas nama user | Dedupe + data reminder |

## 4. Alur Data Notifikasi

```mermaid
flowchart LR
    T[Task] -->|due date| W[Worker]
    R[Reminder] -->|scheduled_at| W
    W -->|buat| N[Notification]
    N -->|user_id| U[User]
    N -.->|opsional workspace_id| WS[Workspace]
    N -.->|opsional task_id| T
```

- Worker membaca reminder/task.
- Notifikasi menyimpan `user_id` penerima dan snapshot pesan.
- `workspace_id`/`task_id` bersifat konteks dan dapat menjadi NULL setelah hard delete.

## 5. Alur Data Session

```mermaid
flowchart LR
    U[User] -->|login| S1[Session family F]
    S1 -->|refresh| S2[Session family F]
    S2 -->|refresh| S3[Session family F]
    S1 -.->|revoked, replaced_by| S2
    S2 -.->|revoked, replaced_by| S3
    S1 -.->|reuse terdeteksi| REVOKE[Revoke seluruh family]
```

- Semua session hasil rotasi berbagi `family_id`.
- `replaced_by_session_id` membentuk rantai untuk audit.
- Reuse token lama → seluruh family dicabut.

## 6. Derajat Normalisasi

| Tabel | Normalisasi | Denormalisasi yang disengaja |
|---|---|---|
| `users` | 3NF | — |
| `user_sessions` | 3NF | `family_id` untuk grouping |
| `workspaces` | 3NF | `owner_id` untuk cek cepat |
| `workspace_members` | 3NF | — |
| `workspace_invitations` | 3NF | `email` disalin (invitee mungkin belum punya akun) |
| `tasks` | 3NF | — |
| `tags`, `labels` | 3NF | — |
| `task_tags`, `task_labels` | Pivot | `workspace_id` untuk composite FK |
| `reminders` | 3NF | `workspace_id`, `user_id` untuk worker tanpa join |
| `notifications` | 3NF + snapshot | `title`, `message` snapshot |

Setiap denormalisasi memiliki alasan integritas atau performa dan dijaga konsisten oleh
constraint atau service.

## 7. Catatan Implementasi Mermaid

- Mermaid tidak menampilkan partial index, check constraint, dan composite FK secara
  eksplisit. Semua ada di [`database-design.md`](database-design.md).
- Tipe `timestamptz` ditulis apa adanya agar sesuai PostgreSQL.
- `UK` pada `users.email` mewakili unique index `lower(email) WHERE deleted_at IS NULL`.
- `UK` pada `notifications.dedupe_key` adalah unique global.
- Relasi `users ||--o| user_sessions` menggambarkan self-reference `replaced_by_session_id`;
  kardinalitas sebenarnya 1:0..1 per baris.
