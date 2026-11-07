import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { ListNotifications } from '../../application/use-cases/list-notifications';
import type {
  GetNotificationPreferences,
  GetUnreadCount,
  MarkAllNotificationsRead,
  MarkNotificationRead,
  UpdateNotificationPreferences
} from '../../application/use-cases/notification-inbox';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';

const notificationSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  type: t.String({ enum: ['reminder_due', 'todo_due_soon'] }),
  title: t.String(),
  body: t.String(),
  data: t.Record(t.String(), t.Any()),
  readAt: t.Union([t.Date(), t.Null()]),
  createdAt: t.Date()
});

export interface NotificationRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly listNotifications: ListNotifications;
  readonly getUnreadCount: GetUnreadCount;
  readonly markNotificationRead: MarkNotificationRead;
  readonly markAllNotificationsRead: MarkAllNotificationsRead;
  readonly getNotificationPreferences: GetNotificationPreferences;
  readonly updateNotificationPreferences: UpdateNotificationPreferences;
}

const SECURITY = [{ bearerAuth: [] }];

export function createNotificationRoutes(deps: NotificationRoutesDependencies) {
  return new Elysia()
    .use(createAuthGuard(deps.getCurrentUser))
    .get(
      '/api/v1/notifications',
      ({ query, user }) =>
        deps.listNotifications.execute({
          userId: user.id,
          ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
          ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
          ...(query.readStatus !== undefined ? { readStatus: query.readStatus } : {}),
          ...(query.type !== undefined ? { type: query.type } : {})
        }),
      {
        query: t.Object({
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
          cursor: t.Optional(t.String({ maxLength: 2048 })),
          readStatus: t.Optional(t.String({ enum: ['all', 'unread', 'read'], default: 'all' })),
          type: t.Optional(t.String({ enum: ['reminder_due', 'todo_due_soon'] }))
        }),
        response: {
          200: t.Object({
            items: t.Array(notificationSchema),
            pagination: t.Object({
              limit: t.Number(),
              hasMore: t.Boolean(),
              nextCursor: t.Union([t.String(), t.Null()])
            })
          }),
          400: errorResponseSchema,
          401: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Notification'],
          summary: 'Daftar notifikasi saya',
          description:
            'Hanya notifikasi milik akun yang login. Urutan createdAt DESC, id DESC. readStatus default all. Email dan in-app adalah channel terpisah; inbox tetap ada saat email dimatikan.',
          security: SECURITY
        }
      }
    )
    .get(
      '/api/v1/notifications/unread-count',
      ({ user }) => deps.getUnreadCount.execute(user.id),
      {
        response: { 200: t.Object({ unreadCount: t.Number() }), 401: errorResponseSchema },
        detail: {
          tags: ['Notification'],
          summary: 'Jumlah notifikasi belum dibaca',
          description: 'COUNT hanya untuk penerima yang sedang login.',
          security: SECURITY
        }
      }
    )
    .get(
      '/api/v1/notifications/preferences',
      ({ user }) => deps.getNotificationPreferences.execute(user.id),
      {
        response: {
          200: t.Object({
            preferences: t.Object({ inAppEnabled: t.Literal(true), emailEnabled: t.Boolean() })
          }),
          401: errorResponseSchema
        },
        detail: {
          tags: ['Notification'],
          summary: 'Baca preferensi notifikasi',
          description: 'In-app selalu aktif. Email default mati sampai pengguna mengaktifkannya.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/api/v1/notifications/preferences',
      ({ user, body }) => deps.updateNotificationPreferences.execute({ userId: user.id, emailEnabled: body.emailEnabled }),
      {
        body: t.Object({ emailEnabled: t.Boolean() }, { additionalProperties: false }),
        response: {
          200: t.Object({
            preferences: t.Object({ inAppEnabled: t.Literal(true), emailEnabled: t.Boolean() })
          }),
          401: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Notification'],
          summary: 'Ubah preferensi email',
          description:
            'Berlaku untuk notifikasi yang belum dibuat. Job email pending yang belum terkirim dilewati bila email dimatikan. Notifikasi lama tidak dikirim ulang.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/api/v1/notifications/read-all',
      ({ user }) => deps.markAllNotificationsRead.execute(user.id),
      {
        response: { 200: t.Object({ updated: t.Number() }), 401: errorResponseSchema },
        detail: {
          tags: ['Notification'],
          summary: 'Tandai semua notifikasi dibaca',
          description: 'Satu pembaruan massal untuk baris unread milik pengguna ini.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/api/v1/notifications/:notificationId/read',
      ({ params, user }) =>
        deps.markNotificationRead.execute({ userId: user.id, notificationId: params.notificationId }),
      {
        response: {
          200: t.Object({ notification: notificationSchema }),
          401: errorResponseSchema,
          404: errorResponseSchema
        },
        detail: {
          tags: ['Notification'],
          summary: 'Tandai satu notifikasi dibaca',
          description: 'Idempoten. Notifikasi milik pengguna lain dikembalikan sebagai tidak ditemukan.',
          security: SECURITY
        }
      }
    );
}
