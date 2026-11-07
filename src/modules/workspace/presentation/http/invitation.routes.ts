import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { AcceptInvitation } from '../../application/use-cases/invitations/accept-invitation';
import type { CreateInvitation } from '../../application/use-cases/invitations/create-invitation';
import type { DeclineInvitation } from '../../application/use-cases/invitations/decline-invitation';
import type { ListInvitations } from '../../application/use-cases/invitations/list-invitations';
import type { ListMyInvitations } from '../../application/use-cases/invitations/list-my-invitations';
import type { ResendInvitation } from '../../application/use-cases/invitations/resend-invitation';
import type { RevokeInvitation } from '../../application/use-cases/invitations/revoke-invitation';
import {
  createInvitationBodySchema,
  declinedInvitationResponseSchema,
  errorResponseSchema,
  invitationListQuerySchema,
  invitationListResponseSchema,
  invitationResponseSchema,
  invitationTokenBodySchema,
  membershipResponseSchema,
  myInvitationListQuerySchema,
  myInvitationListResponseSchema
} from './invitation.schemas';

export interface InvitationRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly createInvitation: CreateInvitation;
  readonly listInvitations: ListInvitations;
  readonly listMyInvitations: ListMyInvitations;
  readonly resendInvitation: ResendInvitation;
  readonly revokeInvitation: RevokeInvitation;
  readonly acceptInvitation: AcceptInvitation;
  readonly declineInvitation: DeclineInvitation;
}

const SECURITY = [{ bearerAuth: [] }];

export function createInvitationRoutes(deps: InvitationRoutesDependencies) {
  return new Elysia()
    .use(createAuthGuard(deps.getCurrentUser))
    .post(
      '/api/v1/workspaces/:workspaceId/invitations',
      async ({ params, body, user, set }) => {
        const result = await deps.createInvitation.execute({
          workspaceId: params.workspaceId,
          userId: user.id,
          inviterEmail: user.email,
          inviterName: user.displayName,
          email: body.email,
          role: body.role
        });
        set.status = 201;
        return result;
      },
      {
        body: createInvitationBodySchema,
        response: { 201: invitationResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Buat undangan workspace',
          description:
            'Owner dapat mengundang admin atau member. Admin hanya dapat mengundang member. Token mentah hanya masuk ke email pada fragment URL, tidak ke response. Jika SMTP gagal, undangan tetap tersimpan dengan deliveryStatus failed.',
          security: SECURITY
        }
      }
    )
    .get(
      '/api/v1/workspaces/:workspaceId/invitations',
      async ({ params, query, user }) =>
        deps.listInvitations.execute({
          workspaceId: params.workspaceId,
          userId: user.id,
          ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
          ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.role !== undefined ? { role: query.role } : {})
        }),
      {
        query: invitationListQuerySchema,
        response: { 200: invitationListResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 422: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Daftar undangan workspace',
          description: 'Owner melihat semua undangan. Admin hanya melihat undangan role member. Cursor opaque memuat fingerprint filter.',
          security: SECURITY
        }
      }
    )
    .post(
      '/api/v1/workspaces/:workspaceId/invitations/:invitationId/resend',
      async ({ params, user }) =>
        deps.resendInvitation.execute({
          workspaceId: params.workspaceId,
          invitationId: params.invitationId,
          userId: user.id,
          inviterName: user.displayName
        }),
      {
        response: { 200: invitationResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Kirim ulang undangan',
          description: 'Membuat token baru, memperbarui expiresAt, dan membuat token lama tidak valid. Admin hanya dapat mengirim ulang undangan member yang dibuatnya.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/api/v1/workspaces/:workspaceId/invitations/:invitationId',
      async ({ params, user, set }) => {
        await deps.revokeInvitation.execute({
          workspaceId: params.workspaceId,
          invitationId: params.invitationId,
          userId: user.id
        });
        set.status = 204;
        return;
      },
      {
        response: { 204: t.Void(), 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Cabut undangan',
          description: 'Mencabut undangan pending. Pemanggilan ulang pada undangan yang sudah revoked tetap 204. Token tidak dapat dipakai lagi.',
          security: SECURITY
        }
      }
    )
    .get(
      '/api/v1/invitations',
      async ({ query, user }) =>
        deps.listMyInvitations.execute({
          userId: user.id,
          email: user.email,
          ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
          ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
          ...(query.status !== undefined ? { status: query.status } : {})
        }),
      {
        query: myInvitationListQuerySchema,
        response: { 200: myInvitationListResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema, 422: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Undangan untuk akun saya',
          description: 'Hanya undangan yang normalized email-nya sama dengan email akun yang login. Client tidak dapat menyaring email orang lain.',
          security: SECURITY
        }
      }
    )
    .post(
      '/api/v1/invitations/:invitationId/accept',
      async ({ params, body, user }) =>
        deps.acceptInvitation.execute({
          invitationId: params.invitationId,
          userId: user.id,
          email: user.email,
          token: body.token
        }),
      {
        body: invitationTokenBodySchema,
        response: { 200: membershipResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Terima undangan',
          description:
            'Wajib login. Email akun harus sama dengan email undangan. Token dikirim di body, bukan query. Role diambil dari undangan, bukan dari client. Jika pengguna sudah anggota, role yang ada tidak ditimpa dan undangan ditutup sebagai accepted.',
          security: SECURITY
        }
      }
    )
    .post(
      '/api/v1/invitations/:invitationId/decline',
      async ({ params, body, user }) =>
        deps.declineInvitation.execute({
          invitationId: params.invitationId,
          email: user.email,
          token: body.token
        }),
      {
        body: invitationTokenBodySchema,
        response: { 200: declinedInvitationResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema, 422: errorResponseSchema },
        detail: {
          tags: ['Invitation'],
          summary: 'Tolak undangan',
          description: 'Menandai undangan declined. Pemanggilan ulang dengan token yang sama tetap declined tanpa menggeser declinedAt.',
          security: SECURITY
        }
      }
    );
}
