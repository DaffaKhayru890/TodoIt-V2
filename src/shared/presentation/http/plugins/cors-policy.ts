import { cors } from '@elysiajs/cors';
import type { AppConfig } from '../../../../config/app-config';
import { REQUEST_ID_HEADER } from '../middleware/request-context';

const ALLOWED_HEADERS = ['content-type', 'authorization', 'x-request-id'];
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Kebijakan CORS ditentukan environment lewat CORS_ALLOWED_ORIGINS. Daftar kosong berarti
 * server tidak memancarkan header CORS sama sekali (mis. backend yang hanya
 * diakses server-to-server atau lewat reverse proxy).
 */
export function createCorsPlugin(config: AppConfig) {
  return cors({
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
    methods: [...ALLOWED_METHODS],
    allowedHeaders: ALLOWED_HEADERS,
    exposeHeaders: [REQUEST_ID_HEADER],
    credentials: true,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS
  });
}
