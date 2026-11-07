import { Elysia } from 'elysia';
import type { GetCurrentUser } from '../../application/use-cases/get-current-user';
import type { AuthenticatedUser } from '../../application/dto/authenticated-user';

export function createAuthGuard(getCurrentUser: GetCurrentUser) {
  return new Elysia({ name: 'auth-guard' }).resolve(
    { as: 'scoped' },
    async ({ request, headers }): Promise<{ user: AuthenticatedUser }> => {
      const authHeader = headers['authorization'] ?? request.headers.get('authorization');
      const user = await getCurrentUser.execute({ authorizationHeader: authHeader });
      return { user };
    }
  );
}
