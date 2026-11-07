import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/bootstrap/create-app';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { FixedClock } from '../../src/shared/domain/clock';
import { GetCurrentUser } from '../../src/modules/auth/application/use-cases/get-current-user';
import { JoseAccessTokenService } from '../../src/modules/auth/infrastructure/security/jose-access-token.service';
import { Notification } from '../../src/modules/notification/domain/entities/notification';
import { ListNotifications } from '../../src/modules/notification/application/use-cases/list-notifications';
import {
  GetNotificationPreferences,
  GetUnreadCount,
  MarkAllNotificationsRead,
  MarkNotificationRead,
  UpdateNotificationPreferences
} from '../../src/modules/notification/application/use-cases/notification-inbox';
import { Base64UrlNotificationCursorCodec } from '../../src/modules/notification/infrastructure/pagination/notification-cursor';
import { buildTestAppConfig } from '../helpers/test-app-config';
import { connectedProbe } from '../helpers/test-app';
import { InMemoryAuthRepository } from '../helpers/in-memory-auth-repository';
import { InMemoryNotificationPreferences, InMemoryNotificationRepository } from '../helpers/in-memory-notification';
import { authHeader, createAuthenticatedUser, jsonHeaders, TEST_NOW } from '../helpers/todo-test-app';

function buildApp() {
  const config = buildTestAppConfig();
  const clock = new FixedClock(TEST_NOW);
  const authRepo = new InMemoryAuthRepository();
  const notifications = new InMemoryNotificationRepository();
  const preferences = new InMemoryNotificationPreferences();
  const accessTokenService = new JoseAccessTokenService({
    secret: config.auth.jwtSecret,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    clock
  });
  const getCurrentUser = new GetCurrentUser(authRepo, authRepo, accessTokenService, clock);
  const cursor = new Base64UrlNotificationCursorCodec();
  const app = createApp({
    config,
    logger: createLogger('silent'),
    readiness: new CheckServiceReadiness(connectedProbe),
    notification: {
      getCurrentUser,
      listNotifications: new ListNotifications(notifications, cursor),
      getUnreadCount: new GetUnreadCount(notifications),
      markNotificationRead: new MarkNotificationRead(notifications, clock),
      markAllNotificationsRead: new MarkAllNotificationsRead(notifications, clock),
      getNotificationPreferences: new GetNotificationPreferences(preferences, clock),
      updateNotificationPreferences: new UpdateNotificationPreferences(preferences, clock)
    }
  });

  return { app, authRepo, accessTokenService, notifications };
}

describe('notification HTTP', () => {
  test('inbox, isolasi pengguna, preferensi, dan OpenAPI', async () => {
    const fixture = buildApp();
    const owner = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'owner@example.com');
    const other = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'other@example.com');
    const first = Notification.create({
      id: crypto.randomUUID(),
      recipientUserId: owner.userId,
      workspaceId: crypto.randomUUID(),
      todoId: crypto.randomUUID(),
      reminderId: null,
      type: 'todo_due_soon',
      title: 'Upcoming Deadline',
      body: 'Your task is due in 1 hour.',
      data: { todoId: crypto.randomUUID() },
      idempotencyKey: 'n1',
      now: TEST_NOW
    });
    const second = Notification.create({
      id: crypto.randomUUID(),
      recipientUserId: other.userId,
      workspaceId: crypto.randomUUID(),
      todoId: null,
      reminderId: null,
      type: 'reminder_due',
      title: 'Todo Reminder',
      body: 'hidden',
      data: {},
      idempotencyKey: 'n2',
      now: new Date(TEST_NOW.getTime() + 1000)
    });
    await fixture.notifications.insert(first);
    await fixture.notifications.insert(second);

    const unauthenticated = await fixture.app.handle(new Request('http://test.local/api/v1/notifications'));
    expect(unauthenticated.status).toBe(401);

    const listed = await fixture.app.handle(
      new Request('http://test.local/api/v1/notifications?readStatus=unread', { headers: authHeader(owner.token) })
    );
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: Array<{ id: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(first.id);

    const count = await fixture.app.handle(
      new Request('http://test.local/api/v1/notifications/unread-count', { headers: authHeader(owner.token) })
    );
    expect(((await count.json()) as { unreadCount: number }).unreadCount).toBe(1);

    const foreign = await fixture.app.handle(
      new Request(`http://test.local/api/v1/notifications/${second.id}/read`, {
        method: 'PATCH',
        headers: authHeader(owner.token)
      })
    );
    expect(foreign.status).toBe(404);

    const read = await fixture.app.handle(
      new Request(`http://test.local/api/v1/notifications/${first.id}/read`, {
        method: 'PATCH',
        headers: authHeader(owner.token)
      })
    );
    expect(read.status).toBe(200);
    const again = await fixture.app.handle(
      new Request(`http://test.local/api/v1/notifications/${first.id}/read`, {
        method: 'PATCH',
        headers: authHeader(owner.token)
      })
    );
    expect(again.status).toBe(200);

    const preferences = await fixture.app.handle(
      new Request('http://test.local/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ emailEnabled: true })
      })
    );
    expect(preferences.status).toBe(200);
    expect(((await preferences.json()) as { preferences: { inAppEnabled: boolean; emailEnabled: boolean } }).preferences).toEqual({
      inAppEnabled: true,
      emailEnabled: true
    });

    const spec = await fixture.app.handle(new Request('http://test.local/openapi/json'));
    const document = (await spec.json()) as { paths: Record<string, unknown> };
    const extra = Notification.create({
      id: '00000000-0000-4000-8000-000000000002',
      recipientUserId: owner.userId,
      workspaceId: crypto.randomUUID(),
      todoId: null,
      reminderId: null,
      type: 'reminder_due',
      title: 'Todo Reminder',
      body: 'later',
      data: {},
      idempotencyKey: 'n3',
      now: new Date(TEST_NOW.getTime() + 2000)
    });
    await fixture.notifications.insert(extra);
    const page = await fixture.app.handle(
      new Request('http://test.local/api/v1/notifications?limit=1&type=todo_due_soon', { headers: authHeader(owner.token) })
    );
    const pageBody = (await page.json()) as { items: Array<{ id: string }>; pagination: { hasMore: boolean; nextCursor: string | null } };
    expect(pageBody.items).toHaveLength(1);
    expect(pageBody.pagination.hasMore).toBe(false);

    const marked = await fixture.app.handle(
      new Request('http://test.local/api/v1/notifications/read-all', { method: 'PATCH', headers: authHeader(owner.token) })
    );
    expect(((await marked.json()) as { updated: number }).updated).toBeGreaterThanOrEqual(1);
    const after = await fixture.app.handle(
      new Request('http://test.local/api/v1/notifications/unread-count', { headers: authHeader(owner.token) })
    );
    expect(((await after.json()) as { unreadCount: number }).unreadCount).toBe(0);

    expect(document.paths['/api/v1/notifications']).toBeDefined();
    expect(document.paths['/api/v1/notifications/preferences']).toBeDefined();
    expect(JSON.stringify(document.paths)).not.toContain('notification_jobs');
  });
});
