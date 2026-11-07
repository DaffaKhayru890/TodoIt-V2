import { openapi } from '@elysia/openapi';
import type { AppConfig } from '../../../../config/app-config';

const API_DESCRIPTION = [
  'Backend aplikasi Todo List.',
  'Phase 1 baru menyediakan fondasi: liveness probe, readiness probe, dan dokumentasi OpenAPI.',
  'Phase 2 menambahkan Authentication dan Workspace Management.',
  'Endpoint bisnis berikutnya ditambahkan pada phase selanjutnya.',
  'Seluruh error memakai satu sampul yang sama: `{ "error": { "code", "message", "requestId" } }`.'
].join(' ');

const API_TAGS = [
  { name: 'Health', description: 'Liveness dan readiness probe untuk orkestrasi container dan monitoring.' },
  { name: 'Auth', description: 'Autentikasi pengguna, manajemen session, dan token JWT.' },
  { name: 'Workspace', description: 'Manajemen workspace dan role-based authorization.' },
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
