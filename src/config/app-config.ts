import {
  EnvironmentConfigurationError,
  asCookieSameSite,
  asLogLevel,
  asNodeEnvironment,
  parseDueSoonOffsets,
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
  readonly poolMax: number;
  readonly idleTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly statementTimeoutMs: number;
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
  /** Secret lama yang masih boleh memverifikasi token aktif. Penandatanganan memakai jwtSecret saat ini. */
  readonly jwtPreviousSecrets: readonly string[];
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly refreshCookie: RefreshCookieConfig;
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly from: string;
  readonly secure: boolean;
  readonly connectionTimeoutMs: number;
}

export interface NotificationConfig {
  readonly workerEnabled: boolean;
  readonly pollIntervalMs: number;
  readonly concurrency: number;
  readonly leaseSeconds: number;
  readonly maxAttempts: number;
  readonly baseRetrySeconds: number;
  readonly maxRetrySeconds: number;
  readonly schedulerIntervalSeconds: number;
  readonly lookaheadDays: number;
  readonly dueSoonOffsetMinutes: readonly number[];
  readonly completedRetentionDays: number;
  readonly failedRetentionDays: number;
}

export interface SecurityConfig {
  readonly trustedProxyHops: number;
  readonly requestBodyLimitBytes: number;
  readonly requestTimeoutMs: number;
  readonly shutdownGraceMs: number;
  readonly hsts: boolean;
  readonly auditRetentionDays: number;
  readonly rateLimit: {
    readonly enabled: boolean;
    readonly authPerMinute: number;
    readonly invitationPerMinute: number;
    readonly todoWritePerMinute: number;
    readonly notificationPerMinute: number;
  };
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
  readonly smtp: SmtpConfig;
  readonly webAppUrl: string;
  readonly invitationTokenTtlSeconds: number;
  readonly notification: NotificationConfig;
  readonly security: SecurityConfig;
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
      ssl: readBoolean(parsed, 'DATABASE_SSL'),
      poolMax: readNumber(parsed, 'DATABASE_POOL_MAX'),
      idleTimeoutMs: readNumber(parsed, 'DATABASE_IDLE_TIMEOUT_MS'),
      connectionTimeoutMs: readNumber(parsed, 'DATABASE_CONNECTION_TIMEOUT_MS'),
      statementTimeoutMs: readNumber(parsed, 'DATABASE_STATEMENT_TIMEOUT_MS')
    },
    auth: {
      jwtSecret: readString(parsed, 'AUTH_JWT_SECRET'),
      jwtPreviousSecrets: readStringList(parsed, 'AUTH_JWT_PREVIOUS_SECRETS'),
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
    },
    smtp: {
      host: readString(parsed, 'SMTP_HOST'),
      port: readNumber(parsed, 'SMTP_PORT'),
      user: readString(parsed, 'SMTP_USER'),
      password: readString(parsed, 'SMTP_PASSWORD'),
      from: readString(parsed, 'SMTP_FROM'),
      secure: readBoolean(parsed, 'SMTP_SECURE'),
      connectionTimeoutMs: readNumber(parsed, 'SMTP_CONNECTION_TIMEOUT_MS')
    },
    webAppUrl: readString(parsed, 'WEB_APP_URL'),
    invitationTokenTtlSeconds: readNumber(parsed, 'INVITATION_TOKEN_TTL_SECONDS'),
    notification: readNotificationConfig(parsed),
    security: {
      trustedProxyHops: readNumber(parsed, 'TRUSTED_PROXY_HOPS'),
      requestBodyLimitBytes: readNumber(parsed, 'REQUEST_BODY_LIMIT_BYTES'),
      requestTimeoutMs: readNumber(parsed, 'REQUEST_TIMEOUT_MS'),
      shutdownGraceMs: readNumber(parsed, 'SHUTDOWN_GRACE_MS'),
      hsts: readBoolean(parsed, 'SECURITY_HSTS'),
      auditRetentionDays: readNumber(parsed, 'AUDIT_LOG_RETENTION_DAYS'),
      rateLimit: {
        enabled: readBoolean(parsed, 'RATE_LIMIT_ENABLED'),
        authPerMinute: readNumber(parsed, 'RATE_LIMIT_AUTH_PER_MINUTE'),
        invitationPerMinute: readNumber(parsed, 'RATE_LIMIT_INVITATION_PER_MINUTE'),
        todoWritePerMinute: readNumber(parsed, 'RATE_LIMIT_TODO_WRITE_PER_MINUTE'),
        notificationPerMinute: readNumber(parsed, 'RATE_LIMIT_NOTIFICATION_PER_MINUTE')
      }
    }
  };
}

function readNotificationConfig(parsed: ParsedEnv): NotificationConfig {
  const offsets = parseDueSoonOffsets(readString(parsed, 'TODO_DUE_SOON_OFFSETS_MINUTES'));

  if (typeof offsets === 'string') {
    throw new EnvironmentConfigurationError([offsets]);
  }

  return {
    workerEnabled: readBoolean(parsed, 'NOTIFICATION_WORKER_ENABLED'),
    pollIntervalMs: readNumber(parsed, 'NOTIFICATION_WORKER_POLL_INTERVAL_MS'),
    concurrency: readNumber(parsed, 'NOTIFICATION_WORKER_CONCURRENCY'),
    leaseSeconds: readNumber(parsed, 'NOTIFICATION_JOB_LEASE_SECONDS'),
    maxAttempts: readNumber(parsed, 'NOTIFICATION_JOB_MAX_ATTEMPTS'),
    baseRetrySeconds: readNumber(parsed, 'NOTIFICATION_JOB_BASE_RETRY_SECONDS'),
    maxRetrySeconds: readNumber(parsed, 'NOTIFICATION_JOB_MAX_RETRY_SECONDS'),
    schedulerIntervalSeconds: readNumber(parsed, 'NOTIFICATION_SCHEDULER_INTERVAL_SECONDS'),
    lookaheadDays: readNumber(parsed, 'NOTIFICATION_LOOKAHEAD_DAYS'),
    dueSoonOffsetMinutes: offsets,
    completedRetentionDays: readNumber(parsed, 'NOTIFICATION_JOB_COMPLETED_RETENTION_DAYS'),
    failedRetentionDays: readNumber(parsed, 'NOTIFICATION_JOB_FAILED_RETENTION_DAYS')
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
    databasePoolMax: config.database.poolMax,
    rateLimitEnabled: config.security.rateLimit.enabled,
    accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds,
    refreshCookie: `${config.auth.refreshCookie.name} sameSite=${config.auth.refreshCookie.sameSite} secure=${config.auth.refreshCookie.secure}`,
    smtpHost: config.smtp.host,
    smtpPort: config.smtp.port,
    webAppUrl: config.webAppUrl,
    invitationTokenTtlSeconds: config.invitationTokenTtlSeconds,
    notificationWorkerEnabled: config.notification.workerEnabled,
    dueSoonOffsets: config.notification.dueSoonOffsetMinutes.join(',')
  };
}
