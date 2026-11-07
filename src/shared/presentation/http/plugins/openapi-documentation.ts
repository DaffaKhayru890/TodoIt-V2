import { openapi } from '@elysia/openapi';
import type { AppConfig } from '../../../../config/app-config';

const API_DESCRIPTION = [
  'Backend aplikasi Todo List.',
  'Phase 1 menyediakan fondasi: liveness probe, readiness probe, dan dokumentasi OpenAPI.',
  'Phase 2 menambahkan Authentication dan Workspace Management.',
  'Phase 3 menambahkan Todo Core Engine: CRUD, status/priority, cursor pagination, filtering, Today, Upcoming, dan Overdue.',
  'Phase 4 menambahkan Todo Metadata Management: Tag (many-to-many), Label (satu per Todo), dan Reminder (absolute/before_due) beserta lifecycle dan filter metadata.',
  'Phase 5 menambahkan kolaborasi workspace: undangan email, anggota, role, dan perpindahan kepemilikan.',
  'Phase 6 menambahkan inbox notifikasi, preferensi email, dan worker latar untuk reminder serta due-soon. Antrian pekerjaan ada di PostgreSQL.',
  'Seluruh error memakai satu sampul yang sama: `{ "error": { "code", "message", "requestId" } }`.'
].join(' ');

const API_TAGS = [
  { name: 'Health', description: 'Liveness dan readiness probe untuk orkestrasi container dan monitoring.' },
  { name: 'Auth', description: 'Autentikasi pengguna, manajemen session, dan token JWT.' },
  { name: 'Workspace', description: 'Manajemen workspace dan role-based authorization.' },
  { name: 'Todo', description: 'Todo Core Engine: CRUD, status/priority, cursor pagination, filtering, Today, Upcoming, dan Overdue.' },
  { name: 'Tag', description: 'Tag workspace-scoped dan assignment many-to-many ke Todo.' },
  { name: 'Label', description: 'Label workspace-scoped dengan warna dan assignment maksimal satu per Todo.' },
  { name: 'Reminder', description: 'Reminder per Todo dengan trigger absolute atau before_due; tanpa pengiriman notifikasi pada fase ini.' },
  { name: 'Invitation', description: 'Undangan workspace melalui email. Token hanya ada di fragment URL dan body POST.' },
  { name: 'Workspace Member', description: 'Anggota workspace, perubahan role, keluar, dan perpindahan kepemilikan.' },
  { name: 'Notification', description: 'Inbox notifikasi milik penerima dan preferensi email. Antrian worker tidak diekspos.' },
  { name: 'Documentation', description: 'Akses dokumen OpenAPI (UI Scalar dan spesifikasi JSON).' }
];

/**
 * Konfigurasi OpenAPI dipusatkan di sini supaya create-app tetap berisi
 * perakitkan saja dan metadata API konsisten dengan isi aplikasi sebenarnya.
 */
export function createOpenApiPlugin(config: AppConfig) {
  const servers =
    config.environment === 'development' || config.environment === 'test'
      ? [
          { url: `http://localhost:${config.port}`, description: 'Instansi lokal development' },
          { url: '/', description: 'Server tempat dokumentasi ini disajikan' }
        ]
      : [{ url: '/', description: `Instansi ${config.environment}` }];

  return openapi({
    path: '/openapi',
    specPath: '/openapi/json',
    provider: 'scalar',
    openapiVersion: '3.1.2',
    documentation: {
      info: {
        title: config.appName,
        version: config.appVersion,
        description: API_DESCRIPTION
      },
      servers,
      tags: API_TAGS,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Access Token pada header Authorization: Bearer <token>'
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: config.auth.refreshCookie.name,
            description: 'HttpOnly cookie berisi refresh token'
          }
        }
      }
    },
    scalar: {
      title: `${config.appName} API`,
      theme: 'kepler'
    }
  });
}
