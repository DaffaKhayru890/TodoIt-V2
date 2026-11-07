import { describe, expect, test } from 'bun:test';
import { describeAppConfig, loadAppConfig } from '../../src/config/app-config';
import { ENV_VARIABLE_NAMES, EnvironmentConfigurationError, parseEnvironment } from '../../src/config/env';

const JWT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  APP_NAME: 'Todo Backend',
  APP_VERSION: '0.1.0',
  APP_PORT: '4000',
  APP_HOST: '0.0.0.0',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'root',
  DATABASE_PASSWORD: 'dev@123',
  DATABASE_NAME: 'todo_development',
  DATABASE_SSL: 'false',
  LOG_LEVEL: 'debug',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000, http://localhost:5173',
  AUTH_JWT_SECRET: JWT_SECRET
};

function envWith(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return { ...VALID_ENV, ...overrides };
}

function configurationProblems(overrides: Record<string, string | undefined>): readonly string[] {
  try {
    loadAppConfig(envWith(overrides));
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      return error.problems;
    }

    throw error;
  }

  return [];
}

describe('loadAppConfig', () => {
  test('mengkonversi string environment menjadi tipe data yang benar', () => {
    const config = loadAppConfig(VALID_ENV);

    expect(config.port).toBe(4000);
    expect(config.database.port).toBe(5432);
    expect(config.database.ssl).toBe(false);
    expect(config.environment).toBe('development');
    expect(config.isProduction).toBe(false);
    expect(config.logLevel).toBe('debug');
    expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:5173']);
  });

  test('memakai nilai default untuk variabel opsional yang kosong', () => {
    const config = loadAppConfig(
      envWith({
        NODE_ENV: undefined,
        APP_PORT: '',
        DATABASE_SSL: undefined,
        LOG_LEVEL: undefined,
        CORS_ALLOWED_ORIGINS: undefined,
        AUTH_JWT_ISSUER: undefined,
        AUTH_JWT_AUDIENCE: undefined,
        AUTH_ACCESS_TOKEN_TTL_SECONDS: undefined,
        AUTH_REFRESH_TOKEN_TTL_SECONDS: undefined,
        AUTH_REFRESH_COOKIE_NAME: undefined,
        AUTH_REFRESH_COOKIE_SECURE: undefined,
        AUTH_REFRESH_COOKIE_SAME_SITE: undefined,
        AUTH_REFRESH_COOKIE_DOMAIN: undefined
      })
    );

    expect(config.environment).toBe('development');
    expect(config.port).toBe(4000);
    expect(config.database.ssl).toBe(false);
    expect(config.logLevel).toBe('info');
    expect(config.corsOrigins).toEqual([]);
    expect(config.auth).toEqual({
      jwtSecret: JWT_SECRET,
      jwtPreviousSecrets: [],
      jwtIssuer: 'todo-backend',
      jwtAudience: 'todo-api',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2_592_000,
      refreshCookie: { name: 'todo_refresh', secure: false, sameSite: 'lax' }
    });
  });

  test('menghanya menyisipkan property domain cookie bila nilainya diisi', () => {
    expect(loadAppConfig(envWith({ AUTH_REFRESH_COOKIE_DOMAIN: 'api.example.test' })).auth.refreshCookie.domain).toBe(
      'api.example.test'
    );
    expect('domain' in loadAppConfig(envWith({ AUTH_REFRESH_COOKIE_DOMAIN: '' })).auth.refreshCookie).toBe(false);
  });

  test('menerima variasi penulisan boolean', () => {
    expect(loadAppConfig(envWith({ DATABASE_SSL: 'true' })).database.ssl).toBe(true);
    expect(loadAppConfig(envWith({ DATABASE_SSL: '1' })).database.ssl).toBe(true);
    expect(loadAppConfig(envWith({ DATABASE_SSL: 'no' })).database.ssl).toBe(false);
  });

  test('menolak NODE_ENV yang tidak dikenal', () => {
    expect(() => loadAppConfig(envWith({ NODE_ENV: 'prod' }))).toThrow(EnvironmentConfigurationError);
  });

  test('menghentikan startup saat variabel wajib hilang dengan pesan yang menyebut nama variabel', () => {
    expect(() => loadAppConfig(envWith({ DATABASE_HOST: undefined, DATABASE_USER: '' }))).toThrow(
      /DATABASE_HOST[\s\S]*DATABASE_USER/
    );
    expect(() => loadAppConfig(envWith({ AUTH_JWT_SECRET: undefined }))).toThrow(/AUTH_JWT_SECRET/);
  });

  test('menolak port di luar rentang valid', () => {
    expect(() => loadAppConfig(envWith({ APP_PORT: '70000' }))).toThrow(/APP_PORT/);
    expect(() => loadAppConfig(envWith({ DATABASE_PORT: 'abc' }))).toThrow(/DATABASE_PORT/);
  });

  test('menolak boolean yang tidak dapat dikenali', () => {
    expect(() => loadAppConfig(envWith({ DATABASE_SSL: 'maybe' }))).toThrow(/DATABASE_SSL/);
  });

  test('mengumpulkan seluruh masalah konfigurasi sekaligus', () => {
    try {
      loadAppConfig(envWith({ APP_PORT: '-1', LOG_LEVEL: 'verbose', DATABASE_SSL: 'maybe' }));
      expect.unreachable('seharusnya throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentConfigurationError);
      expect((error as EnvironmentConfigurationError).problems).toHaveLength(3);
    }
  });

  test('mengenali environment production', () => {
    expect(
      loadAppConfig(
        envWith({
          NODE_ENV: 'production',
          AUTH_REFRESH_COOKIE_SECURE: 'true',
          WEB_APP_URL: 'https://app.example.com',
          SMTP_HOST: 'smtp.example.com',
          SMTP_FROM: 'Todo Backend <noreply@example.com>',
          DATABASE_USER: 'todo_app',
          DATABASE_PASSWORD: 'not-the-development-password',
          DATABASE_SSL: 'true',
          CORS_ALLOWED_ORIGINS: 'https://app.example.com'
        })
      ).isProduction
    ).toBe(true);
  });
});

describe('validasi konfigurasi authentication', () => {
  test('menolak JWT secret yang lebih pendek dari 32 karakter', () => {
    expect(configurationProblems({ AUTH_JWT_SECRET: 'rahasia-pendek' }).join('\n')).toContain('minimal 32 karakter');
  });

  test('menolak placeholder secret yang biasa dipakai tutorial', () => {
    const problems = configurationProblems({ AUTH_JWT_SECRET: 'secret' });

    expect(problems).toHaveLength(1);
  });

  test('menolak TTL akses token di luar rentang aman', () => {
    expect(configurationProblems({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '10' }).join('\n')).toContain(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS'
    );
    expect(configurationProblems({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '999999' }).join('\n')).toContain(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS'
    );
    expect(configurationProblems({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '1.5' }).join('\n')).toContain(
      'bilangan bulat'
    );
  });

  test('menolak TTL refresh token yang tidak masuk akal', () => {
    expect(configurationProblems({ AUTH_REFRESH_TOKEN_TTL_SECONDS: '60' }).join('\n')).toContain(
      'AUTH_REFRESH_TOKEN_TTL_SECONDS'
    );
    expect(configurationProblems({ AUTH_REFRESH_TOKEN_TTL_SECONDS: 'not-a-number' }).join('\n')).toContain(
      'AUTH_REFRESH_TOKEN_TTL_SECONDS'
    );
  });

  test('menolak sameSite nilai di luar lax/strict/none', () => {
    expect(configurationProblems({ AUTH_REFRESH_COOKIE_SAME_SITE: 'no_restriction' })).toHaveLength(1);
  });
});

describe('validasi kombinasi antar variabel', () => {
  test('menolak cookie refresh token tanpa Secure pada production', () => {
    expect(configurationProblems({ NODE_ENV: 'production', AUTH_REFRESH_COOKIE_SECURE: 'false' }).join('\n')).toContain(
      'AUTH_REFRESH_COOKIE_SECURE harus true pada environment production'
    );
  });

  test('menolak cookie refresh token tanpa Secure pada staging', () => {
    expect(configurationProblems({ NODE_ENV: 'staging' }).join('\n')).toContain(
      'AUTH_REFRESH_COOKIE_SECURE harus true pada environment staging'
    );
  });

  test('mengizinkan Secure=false di development dan test', () => {
    expect(configurationProblems({ NODE_ENV: 'development', AUTH_REFRESH_COOKIE_SECURE: 'false' })).toHaveLength(0);
    expect(configurationProblems({ NODE_ENV: 'test', AUTH_REFRESH_COOKIE_SECURE: 'false' })).toHaveLength(0);
  });

  test('menolak SameSite=none tanpa Secure karena browser akan membuang cookie', () => {
    const problems = configurationProblems({
      NODE_ENV: 'development',
      AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
      AUTH_REFRESH_COOKIE_SECURE: 'false'
    });

    expect(problems.join('\n')).toContain('AUTH_REFRESH_COOKIE_SAME_SITE=none mensyaratkan AUTH_REFRESH_COOKIE_SECURE=true');
  });

  test('menolak wildcard origin karena API memakai kredensial', () => {
    expect(configurationProblems({ CORS_ALLOWED_ORIGINS: 'https://app.example, *' }).join('\n')).toContain(
      'CORS_ALLOWED_ORIGINS tidak boleh memuat "*"'
    );
  });

  test('menggabungkan masalah per variabel dan masalah kombinasi dalam satu laporan', () => {
    const problems = configurationProblems({
      NODE_ENV: 'production',
      AUTH_JWT_SECRET: 'pendek',
      AUTH_REFRESH_COOKIE_SECURE: 'false',
      CORS_ALLOWED_ORIGINS: '*'
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('AUTH_JWT_SECRET'),
        expect.stringContaining('AUTH_REFRESH_COOKIE_SECURE'),
        expect.stringContaining('CORS_ALLOWED_ORIGINS'),
        expect.stringContaining('WEB_APP_URL')
      ])
    );
  });
});

describe('parseEnvironment', () => {
  test('menghasilkan entri untuk setiap variabel yang dideklarasikan', () => {
    const parsed = parseEnvironment(envWith({}));

    expect(Object.keys(parsed).sort()).toEqual([...ENV_VARIABLE_NAMES].sort());
  });
});

describe('describeAppConfig', () => {
  test('tidak pernah memuat password database maupun JWT secret', () => {
    const serialized = JSON.stringify(describeAppConfig(loadAppConfig(VALID_ENV)));

    expect(serialized).not.toContain('dev@123');
    expect(serialized).not.toContain(JWT_SECRET);
    expect(serialized).toContain('todo_development');
    expect(serialized).toContain('todo_refresh');
  });
});
