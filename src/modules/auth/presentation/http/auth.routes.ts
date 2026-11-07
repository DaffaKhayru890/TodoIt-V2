import { Elysia, t } from 'elysia';
import type { AppConfig } from '../../../../config/app-config';
import type { RegisterUser } from '../../application/use-cases/register-user';
import type { LoginUser } from '../../application/use-cases/login-user';
import type { RefreshSession } from '../../application/use-cases/refresh-session';
import type { LogoutUser } from '../../application/use-cases/logout-user';
import type { GetCurrentUser } from '../../application/use-cases/get-current-user';
import {
  currentUserResponseSchema,
  errorResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  refreshResponseSchema,
  registerBodySchema,
  registerResponseSchema
} from './auth.schemas';
import { createAuthGuard } from './auth.middleware';

export interface AuthRoutesDependencies {
  readonly config: AppConfig;
  readonly registerUser: RegisterUser;
  readonly loginUser: LoginUser;
  readonly refreshSession: RefreshSession;
  readonly logoutUser: LogoutUser;
  readonly getCurrentUser: GetCurrentUser;
}

function extractCookieValue(request: Request, cookieMap: Record<string, any>, cookieName: string): string | null {
  const fromContext = cookieMap[cookieName]?.value;
  if (typeof fromContext === 'string' && fromContext.length > 0) {
    return fromContext;
  }

  const rawCookieHeader = request.headers.get('cookie');
  if (rawCookieHeader) {
    const match = rawCookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    const matched = match?.[1];
    if (matched) {
      return decodeURIComponent(matched);
    }
  }

  return null;
}

export function createAuthRoutes({
  config,
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getCurrentUser
}: AuthRoutesDependencies) {
  const cookieName = config.auth.refreshCookie.name;

  return new Elysia({ prefix: '/api/v1/auth' })
    .post(
      '/register',
      async ({ body, set }) => {
        const user = await registerUser.execute({
          email: body.email,
          displayName: body.displayName,
          password: body.password
        });

        set.status = 201;
        return { user };
      },
      {
        body: registerBodySchema,
        response: {
          201: registerResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Auth'],
          summary: 'Registrasi Pengguna',
          description: 'Mendaftarkan pengguna baru dengan email dan password. Email dinormalisasi dan harus unik.'
        }
      }
    )
    .post(
      '/login',
      async ({ body, cookie, request }) => {
        const result = await loginUser.execute({
          email: body.email,
          password: body.password,
          userAgent: request.headers.get('user-agent')
        });

        const refreshCookie = cookie[cookieName];
        if (refreshCookie) {
          refreshCookie.set({
            value: result.refreshCookieToken,
            httpOnly: true,
            secure: config.auth.refreshCookie.secure,
            sameSite: config.auth.refreshCookie.sameSite,
            ...(config.auth.refreshCookie.domain ? { domain: config.auth.refreshCookie.domain } : {}),
            path: '/api/v1/auth',
            maxAge: config.auth.refreshTokenTtlSeconds,
            expires: result.refreshCookieExpiresAt
          });
        }

        return {
          user: result.user,
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn
        };
      },
      {
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
          401: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Auth'],
          summary: 'Masuk Akun',
          description:
            'Autentikasi email dan password, menghasilkan JWT access token serta menyetel refresh token pada HttpOnly cookie.'
        }
      }
    )
    .post(
      '/refresh',
      async ({ cookie, request }) => {
        const token = extractCookieValue(request, cookie, cookieName);
        const result = await refreshSession.execute({ refreshToken: token });

        const refreshCookie = cookie[cookieName];
        if (refreshCookie) {
          refreshCookie.set({
            value: result.refreshCookieToken,
            httpOnly: true,
            secure: config.auth.refreshCookie.secure,
            sameSite: config.auth.refreshCookie.sameSite,
            ...(config.auth.refreshCookie.domain ? { domain: config.auth.refreshCookie.domain } : {}),
            path: '/api/v1/auth',
            maxAge: config.auth.refreshTokenTtlSeconds,
            expires: result.refreshCookieExpiresAt
          });
        }

        return {
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn
        };
      },
      {
        response: {
          200: refreshResponseSchema,
          401: errorResponseSchema
        },
        detail: {
          tags: ['Auth'],
          summary: 'Rotasi Refresh Token',
          description:
            'Menerbitkan access token baru dengan merotasi refresh token dari HttpOnly cookie. Token lama menjadi invalid.',
          security: [{ cookieAuth: [] }]
        }
      }
    )
    .post(
      '/logout',
      async ({ cookie, request, set }) => {
        const token = extractCookieValue(request, cookie, cookieName);
        await logoutUser.execute({ refreshToken: token });

        const refreshCookie = cookie[cookieName];
        if (refreshCookie) {
          refreshCookie.remove();
        }

        set.status = 204;
        return;
      },
      {
        response: {
          204: t.Void()
        },
        detail: {
          tags: ['Auth'],
          summary: 'Keluar Akun',
          description: 'Mencabut session aktif yang berasosiasi dengan refresh token dan menghapus cookie.',
          security: [{ cookieAuth: [] }]
        }
      }
    )
    .use(createAuthGuard(getCurrentUser))
    .get(
      '/me',
      async ({ user }) => {
        return { user };
      },
      {
        response: {
          200: currentUserResponseSchema,
          401: errorResponseSchema
        },
        detail: {
          tags: ['Auth'],
          summary: 'Profil Pengguna Saat Ini',
          description: 'Mengambil profil pengguna yang sedang terautentikasi berdasarkan Bearer access token.',
          security: [{ bearerAuth: [] }]
        }
      }
    );
}
