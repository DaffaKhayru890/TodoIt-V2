import {
  COOKIE_SAME_SITE_VALUES,
  LOG_LEVELS,
  NODE_ENVIRONMENTS,
  parseEnvField,
  type CookieSameSite,
  type EnvFieldRule,
  type LogLevel,
  type NodeEnvironment,
  type ParsedEnvValue,
  type RawEnvValue
} from './env-schema';

/**
 * Satu-satunya modul yang menyentuh process.env. Module lain harus mengambil
 * konfigurasi dari AppConfig hasil loadAppConfig().
 */
const ENV_RULES = {
  NODE_ENV: { kind: 'enum', required: false, allowedValues: NODE_ENVIRONMENTS, defaultValue: 'development' },
  APP_NAME: { kind: 'string', required: true },
  APP_VERSION: { kind: 'string', required: true },
  APP_PORT: { kind: 'port', required: false, defaultValue: 4000 },
  APP_HOST: { kind: 'string', required: false, defaultValue: '0.0.0.0' },
  DATABASE_HOST: { kind: 'string', required: true },
  DATABASE_PORT: { kind: 'port', required: false, defaultValue: 5432 },
  DATABASE_USER: { kind: 'string', required: true },
  DATABASE_PASSWORD: { kind: 'string', required: true, secret: true },
  DATABASE_NAME: { kind: 'string', required: true },
  DATABASE_SSL: { kind: 'boolean', required: false, defaultValue: false },
  LOG_LEVEL: { kind: 'enum', required: false, allowedValues: LOG_LEVELS, defaultValue: 'info' },
  CORS_ALLOWED_ORIGINS: { kind: 'csv', required: false, defaultValue: [] },
  APP_DEFAULT_TIMEZONE: { kind: 'string', required: false, defaultValue: 'UTC' },

  AUTH_JWT_SECRET: { kind: 'string', required: true, secret: true, minLength: 32 },
  AUTH_JWT_ISSUER: { kind: 'string', required: false, defaultValue: 'todo-backend' },
  AUTH_JWT_AUDIENCE: { kind: 'string', required: false, defaultValue: 'todo-api' },
  AUTH_ACCESS_TOKEN_TTL_SECONDS: { kind: 'integer', required: false, defaultValue: 900, min: 60, max: 3600 },
  AUTH_REFRESH_TOKEN_TTL_SECONDS: {
    kind: 'integer',
    required: false,
    defaultValue: 2_592_000,
    min: 3600,
    max: 31_536_000
  },
  AUTH_REFRESH_COOKIE_NAME: { kind: 'string', required: false, defaultValue: 'todo_refresh' },
  AUTH_REFRESH_COOKIE_SECURE: { kind: 'boolean', required: false, defaultValue: false },
  AUTH_REFRESH_COOKIE_SAME_SITE: {
    kind: 'enum',
    required: false,
    allowedValues: COOKIE_SAME_SITE_VALUES,
    defaultValue: 'lax'
  },
  AUTH_REFRESH_COOKIE_DOMAIN: { kind: 'string', required: false, defaultValue: '' },
  SMTP_HOST: { kind: 'string', required: false, defaultValue: 'localhost' },
  SMTP_PORT: { kind: 'port', required: false, defaultValue: 1025 },
  SMTP_USER: { kind: 'string', required: false, defaultValue: '' },
  SMTP_PASSWORD: { kind: 'string', required: false, defaultValue: '', secret: true },
  SMTP_FROM: { kind: 'string', required: false, defaultValue: 'Todo Backend <noreply@localhost>' },
  SMTP_SECURE: { kind: 'boolean', required: false, defaultValue: false },
  WEB_APP_URL: { kind: 'string', required: false, defaultValue: 'http://localhost:3000' },
  INVITATION_TOKEN_TTL_SECONDS: {
    kind: 'integer',
    required: false,
    defaultValue: 604_800,
    min: 3600,
    max: 2_592_000
  },
  NOTIFICATION_WORKER_ENABLED: { kind: 'boolean', required: false, defaultValue: true },
  NOTIFICATION_WORKER_POLL_INTERVAL_MS: {
    kind: 'integer',
    required: false,
    defaultValue: 5000,
    min: 100,
    max: 600_000
  },
  NOTIFICATION_WORKER_CONCURRENCY: { kind: 'integer', required: false, defaultValue: 5, min: 1, max: 50 },
  NOTIFICATION_JOB_LEASE_SECONDS: { kind: 'integer', required: false, defaultValue: 60, min: 5, max: 3600 },
  NOTIFICATION_JOB_MAX_ATTEMPTS: { kind: 'integer', required: false, defaultValue: 8, min: 1, max: 20 },
  NOTIFICATION_JOB_BASE_RETRY_SECONDS: { kind: 'integer', required: false, defaultValue: 5, min: 1, max: 3600 },
  NOTIFICATION_JOB_MAX_RETRY_SECONDS: { kind: 'integer', required: false, defaultValue: 3600, min: 1, max: 86_400 },
  NOTIFICATION_SCHEDULER_INTERVAL_SECONDS: {
    kind: 'integer',
    required: false,
    defaultValue: 60,
    min: 5,
    max: 3600
  },
  NOTIFICATION_LOOKAHEAD_DAYS: { kind: 'integer', required: false, defaultValue: 90, min: 1, max: 365 },
  TODO_DUE_SOON_OFFSETS_MINUTES: { kind: 'string', required: false, defaultValue: '1440,60' }
} satisfies Record<string, EnvFieldRule>;

export type EnvVarName = keyof typeof ENV_RULES;

/** Daftar variabel yang dikenal; dipakai test dan dokumentasi. */
export const ENV_VARIABLE_NAMES = Object.keys(ENV_RULES) as readonly EnvVarName[];

/** Variabel wajib yang tidak tersedia, atau variabel yang nilainya tidak valid. */
export class EnvironmentConfigurationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(
      `Konfigurasi environment tidak valid:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n` +
        'Periksa file .env.<NODE_ENV> dan bandingkan dengan .env.<NODE_ENV>.example.'
    );
    this.name = 'EnvironmentConfigurationError';
    this.problems = problems;
  }
}

export type ParsedEnv = Record<EnvVarName, ParsedEnvValue>;

export function parseEnvironment(source: Readonly<Record<string, RawEnvValue>>): ParsedEnv {
  const parsed: Partial<Record<EnvVarName, ParsedEnvValue>> = {};
  const problems: string[] = [];

  for (const [name, rule] of Object.entries(ENV_RULES) as [EnvVarName, EnvFieldRule][]) {
    const result = parseEnvField(name, rule, source[name]);

    if ('error' in result) {
      problems.push(result.error);
      continue;
    }

    parsed[name] = result.value;
  }

  problems.push(...findCombinationProblems(parsed));

  if (problems.length > 0) {
    throw new EnvironmentConfigurationError(problems);
  }

  return parsed as ParsedEnv;
}

/**
 * Aturan yang tidak bisa dinyatakan per variabel: kombinasi antar field yang
 * secara individual valid tetapi berbahaya bila dipakai bersama. Pemeriksaan
 * dilewati bila salah satu inputnya tidak tersedia, supaya tidak menutupi
 * masalah parsing yang sudah dilaporkan lebih dulu.
 */
function findCombinationProblems(parsed: Partial<ParsedEnv>): readonly string[] {
  const problems: string[] = [];
  const environment = parsed.NODE_ENV;
  const cookieSecure = parsed.AUTH_REFRESH_COOKIE_SECURE;
  const sameSite = parsed.AUTH_REFRESH_COOKIE_SAME_SITE;

  if (
    (environment === 'production' || environment === 'staging') &&
    typeof cookieSecure === 'boolean' &&
    !cookieSecure
  ) {
    problems.push(
      `AUTH_REFRESH_COOKIE_SECURE harus true pada environment ${environment}; cookie refresh token tanpa Secure hanya boleh dipakai di development/test.`
    );
  }

  if (sameSite === 'none' && typeof cookieSecure === 'boolean' && !cookieSecure) {
    problems.push(
      'AUTH_REFRESH_COOKIE_SAME_SITE=none mensyaratkan AUTH_REFRESH_COOKIE_SECURE=true karena browser menolak cookie cross-site tanpa Secure.'
    );
  }

  const origins = parsed.CORS_ALLOWED_ORIGINS;

  if (Array.isArray(origins) && origins.includes('*')) {
    problems.push(
      'CORS_ALLOWED_ORIGINS tidak boleh memuat "*" karena API ini memakai kredensial (cookie refresh token dan Authorization header). Daftarkan origin secara eksplisit.'
    );
  }

  const webAppUrl = parsed.WEB_APP_URL;

  if (typeof webAppUrl === 'string' && webAppUrl.length > 0) {
    let parsedUrl: URL | null = null;

    try {
      parsedUrl = new URL(webAppUrl);
    } catch {
      problems.push('WEB_APP_URL harus berupa URL absolut.');
    }

    if (parsedUrl && (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
      problems.push('WEB_APP_URL harus memakai http atau https.');
    }

    if (
      parsedUrl &&
      (environment === 'production' || environment === 'staging') &&
      parsedUrl.protocol !== 'https:'
    ) {
      problems.push(`WEB_APP_URL pada environment ${environment} wajib memakai HTTPS.`);
    }
  }

  const baseRetry = parsed.NOTIFICATION_JOB_BASE_RETRY_SECONDS;
  const maxRetry = parsed.NOTIFICATION_JOB_MAX_RETRY_SECONDS;

  if (typeof baseRetry === 'number' && typeof maxRetry === 'number' && maxRetry < baseRetry) {
    problems.push('NOTIFICATION_JOB_MAX_RETRY_SECONDS harus lebih besar atau sama dengan NOTIFICATION_JOB_BASE_RETRY_SECONDS.');
  }

  const offsets = parsed.TODO_DUE_SOON_OFFSETS_MINUTES;
  const lookahead = parsed.NOTIFICATION_LOOKAHEAD_DAYS;

  if (typeof offsets === 'string') {
    const parsedOffsets = parseDueSoonOffsets(offsets);

    if (typeof parsedOffsets === 'string') {
      problems.push(parsedOffsets);
    } else if (typeof lookahead === 'number') {
      const maxOffset = parsedOffsets[parsedOffsets.length - 1] ?? 0;

      if (lookahead * 24 * 60 < maxOffset) {
        problems.push(
          'NOTIFICATION_LOOKAHEAD_DAYS harus cukup besar untuk offset due-soon terbesar supaya jadwal tidak terlewat.'
        );
      }
    }
  }

  return problems;
}

/** Offset due-soon, unik, terurut naik. Mengembalikan pesan error bila tidak valid. */
export function parseDueSoonOffsets(raw: string): readonly number[] | string {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return 'TODO_DUE_SOON_OFFSETS_MINUTES wajib berisi minimal satu offset menit.';
  }

  const seen = new Set<number>();
  const values: number[] = [];

  for (const part of parts) {
    if (!/^[1-9]\d*$/.test(part)) {
      return 'TODO_DUE_SOON_OFFSETS_MINUTES harus bilangan bulat positif yang dipisah koma.';
    }

    const value = Number(part);

    if (value > 43_200) {
      return 'TODO_DUE_SOON_OFFSETS_MINUTES tidak boleh lebih dari 43200 menit.';
    }

    if (seen.has(value)) {
      return 'TODO_DUE_SOON_OFFSETS_MINUTES tidak boleh berisi offset duplikat.';
    }

    seen.add(value);
    values.push(value);
  }

  return values.sort((left, right) => left - right);
}

/** Tipe bantu supaya pemanggil tidak perlu casting manual per variabel. */
export function asNodeEnvironment(value: ParsedEnvValue): NodeEnvironment {
  if (typeof value !== 'string') {
    throw new EnvironmentConfigurationError([`NODE_ENV bernilai ${typeof value}, seharusnya string`]);
  }

  return value as NodeEnvironment;
}

export function asLogLevel(value: ParsedEnvValue): LogLevel {
  return value as LogLevel;
}

export function asCookieSameSite(value: ParsedEnvValue): CookieSameSite {
  return value as CookieSameSite;
}
