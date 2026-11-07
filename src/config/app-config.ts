import {
  EnvironmentConfigurationError,
  asCookieSameSite,
  asLogLevel,
  asNodeEnvironment,
  parseEnvironment,
  type EnvVarName,
  type ParsedEnv
} from './env';
import type { CookieSameSite, LogLevel, NodeEnvironment } from './env-schema';
import { isValidTimeZone } from '../shared/domain/time/timezone';

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly name: string;
  readonly ssl: boolean;
}

export interface RefreshCookieConfig {
  readonly name: string;
  readonly secure: boolean;
  readonly sameSite: CookieSameSite;
  /** Tidak diset bila AUTH_REFRESH_COOKIE_DOMAIN kosong. */
  readonly domain?: string;
}

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly refreshCookie: RefreshCookieConfig;
}

export interface AppConfig {
  readonly environment: NodeEnvironment;
  readonly isProduction: boolean;
  readonly appName: string;
  readonly appVersion: string;
  readonly port: number;
  readonly host: string;
  readonly logLevel: LogLevel;
  /** IANA timezone default untuk Today/Upcoming/Overdue bila client tidak mengirim timezone. */
  readonly defaultTimezone: string;
  /** Origin yang diizinkan CORS. Array kosong berarti tidak ada origin eksplisit. */
  readonly corsOrigins: readonly string[];
  readonly database: DatabaseConfig;
  readonly auth: AuthConfig;
}

function readString(config: ParsedEnv, name: EnvVarName): string {
  const value = config[name];

  if (typeof value !== 'string') {
    throw new TypeError(`${name} diharapkan bertipe string, mendapatkan ${typeof value}`);
  }

  return value;
}

function readNumber(config: ParsedEnv, name: EnvVarName): number {
  const value = config[name];

  if (typeof value !== 'number') {
    throw new TypeError(`${name} diharapkan bertipe number, mendapatkan ${typeof value}`);
  }

  return value;
}

function readBoolean(config: ParsedEnv, name: EnvVarName): boolean {
  const value = config[name];

  if (typeof value !== 'boolean') {
    throw new TypeError(`${name} diharapkan bertipe boolean, mendapatkan ${typeof value}`);
  }

  return value;
}

function readStringList(config: ParsedEnv, name: EnvVarName): readonly string[] {
  const value = config[name];

  if (!Array.isArray(value)) {
    throw new TypeError(`${name} diharapkan berupa daftar string, mendapatkan ${typeof value}`);
  }

  return value;
}

/**
 * Membaca process.env, memvalidasi, dan merakit konfigurasi bertipe.
 * Dipanggil sekali di composition root; kegagalan di sini menghentikan startup.
 */
export function loadAppConfig(source: Readonly<Record<string, string | undefined>> = process.env): AppConfig {
  const parsed = parseEnvironment(source);
  const environment = asNodeEnvironment(parsed.NODE_ENV);
  const cookieDomain = readString(parsed, 'AUTH_REFRESH_COOKIE_DOMAIN');
  const defaultTimezone = readString(parsed, 'APP_DEFAULT_TIMEZONE');

  if (!isValidTimeZone(defaultTimezone)) {
    throw new EnvironmentConfigurationError([
      `APP_DEFAULT_TIMEZONE harus berupa IANA timezone yang valid (ditemukan: "${defaultTimezone}"). Gunakan nilai seperti UTC, Asia/Jakarta, atau America/New_York.`
    ]);
  }

  return {
    environment,
    isProduction: environment === 'production',
    appName: readString(parsed, 'APP_NAME'),
    appVersion: readString(parsed, 'APP_VERSION'),
    port: readNumber(parsed, 'APP_PORT'),
    host: readString(parsed, 'APP_HOST'),
    logLevel: asLogLevel(parsed.LOG_LEVEL),
    defaultTimezone,
    corsOrigins: readStringList(parsed, 'CORS_ALLOWED_ORIGINS'),
    database: {
      host: readString(parsed, 'DATABASE_HOST'),
      port: readNumber(parsed, 'DATABASE_PORT'),
      user: readString(parsed, 'DATABASE_USER'),
      password: readString(parsed, 'DATABASE_PASSWORD'),
      name: readString(parsed, 'DATABASE_NAME'),
      ssl: readBoolean(parsed, 'DATABASE_SSL')
    },
    auth: {
      jwtSecret: readString(parsed, 'AUTH_JWT_SECRET'),
      jwtIssuer: readString(parsed, 'AUTH_JWT_ISSUER'),
      jwtAudience: readString(parsed, 'AUTH_JWT_AUDIENCE'),
      accessTokenTtlSeconds: readNumber(parsed, 'AUTH_ACCESS_TOKEN_TTL_SECONDS'),
      refreshTokenTtlSeconds: readNumber(parsed, 'AUTH_REFRESH_TOKEN_TTL_SECONDS'),
      refreshCookie: {
        name: readString(parsed, 'AUTH_REFRESH_COOKIE_NAME'),
        secure: readBoolean(parsed, 'AUTH_REFRESH_COOKIE_SECURE'),
        sameSite: asCookieSameSite(parsed.AUTH_REFRESH_COOKIE_SAME_SITE),
        ...(cookieDomain.length > 0 ? { domain: cookieDomain } : {})
      }
    }
  };
}

/** Representasi aman untuk logging: kredensial tidak pernah ikut dicetak. */
export function describeAppConfig(config: AppConfig): Record<string, string | number | boolean> {
  return {
    environment: config.environment,
    appName: config.appName,
    appVersion: config.appVersion,
    host: config.host,
    port: config.port,
    logLevel: config.logLevel,
    defaultTimezone: config.defaultTimezone,
    corsOrigins: config.corsOrigins.join(',') || '(none)',
    database: `${config.database.user}@${config.database.host}:${config.database.port}/${config.database.name}`,
    databaseSsl: config.database.ssl,
    accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds,
    refreshCookie: `${config.auth.refreshCookie.name} sameSite=${config.auth.refreshCookie.sameSite} secure=${config.auth.refreshCookie.secure}`
  };
}
