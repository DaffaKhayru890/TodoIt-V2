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
  AUTH_REFRESH_COOKIE_DOMAIN: { kind: 'string', required: false, defaultValue: '' }
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

  return problems;
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
