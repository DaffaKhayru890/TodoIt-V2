import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { ChangeMemberRole } from '../../application/use-cases/members/change-member-role';
import type { GetMember } from '../../application/use-cases/members/get-member';
import type { LeaveWorkspace } from '../../application/use-cases/members/leave-workspace';
import type { ListMembers } from '../../application/use-cases/members/list-members';
import type { RemoveMember } from '../../application/use-cases/members/remove-member';
import type { TransferOwnership } from '../../application/use-cases/members/transfer-ownership';
import {
  changeRoleBodySchema,
  errorResponseSchema,
  memberListQuerySchema,
  memberListResponseSchema,
  memberResponseSchema,
  transferOwnershipBodySchema,
  transferOwnershipResponseSchema
} from './member.schemas';

export interface MemberRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly listMembers: ListMembers;
  readonly getMember: GetMember;
  readonly changeMemberRole: ChangeMemberRole;
  readonly removeMember: RemoveMember;
  readonly leaveWorkspace: LeaveWorkspace;
  readonly transferOwnership: TransferOwnership;
}

const SECURITY = [{ bearerAuth: [] }];

export function createMemberRoutes(deps: MemberRoutesDependencies) {
  return new Elysia()
    .use(createAuthGuard(deps.getCurrentUser))
    .get(
      '/api/v1/workspaces/:workspaceId/members',
      async ({ params, query, user }) =>
        deps.listMembers.execute({
          workspaceId: params.workspaceId,
          userId: user.id,
          ...(query.limit !== undefined ? { limit: Number(query.limit) } : {}),
          ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
          ...(query.role !== undefined ? { role: query.role } : {})
        }),
      {
        query: memberListQuerySchema,
        response: {
          200: memberListResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Workspace Member'],
          summary: 'Daftar anggota workspace',
          description: 'Semua member dapat melihat daftar. Urutan joinedAt DESC, userId DESC. Tidak memuat password atau session.',
          security: SECURITY
        }
      }
    )
    .get(
      '/api/v1/workspaces/:workspaceId/members/:userId',
      async ({ params, user }) =>
        deps.getMember.execute({
          workspaceId: params.workspaceId,
          actorId: user.id,
          memberUserId: params.userId
        }),
      {
        response: { 200: memberResponseSchema, 401: errorResponseSchema, 404: errorResponseSchema },
        detail: {
          tags: ['Workspace Member'],
          summary: 'Detail anggota',
          description: 'Hanya anggota workspace yang dapat melihat anggota lain pada workspace yang sama.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/api/v1/workspaces/:workspaceId/members/:userId',
      async ({ params, body, user }) =>
        deps.changeMemberRole.execute({
          workspaceId: params.workspaceId,
          actorId: user.id,
          memberUserId: params.userId,
          role: body.role
        }),
      {
        body: changeRoleBodySchema,
        response: {
          200: memberResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Workspace Member'],
          summary: 'Ubah role anggota',
          description: 'Hanya owner. Role yang diizinkan admin atau member. Owner tidak diubah di endpoint ini.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/api/v1/workspaces/:workspaceId/members/:userId',
      async ({ params, user, set }) => {
        await deps.removeMember.execute({
          workspaceId: params.workspaceId,
          actorId: user.id,
          memberUserId: params.userId
        });
        set.status = 204;
        return;
      },
      {
        response: { 204: t.Void(), 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema },
        detail: {
          tags: ['Workspace Member'],
          summary: 'Hapus anggota',
          description: 'Owner dapat menghapus admin dan member. Admin hanya dapat menghapus member. Akun user, todo, dan workspace tidak ikut terhapus.',
          security: SECURITY
        }
      }
    )
    .post(
      '/api/v1/workspaces/:workspaceId/leave',
      async ({ params, user, set }) => {
        await deps.leaveWorkspace.execute({ workspaceId: params.workspaceId, userId: user.id });
        set.status = 204;
        return;
      },
      {
        response: { 204: t.Void(), 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 409: errorResponseSchema },
        detail: {
          tags: ['Workspace Member'],
          summary: 'Keluar dari workspace',
          description: 'Member dan admin dapat keluar. Owner harus transfer ownership terlebih dahulu (409 OWNER_TRANSFER_REQUIRED).',
          security: SECURITY
        }
      }
    )
    .post(
      '/api/v1/workspaces/:workspaceId/transfer-ownership',
      async ({ params, body, user }) =>
        deps.transferOwnership.execute({
          workspaceId: params.workspaceId,
          actorId: user.id,
          newOwnerUserId: body.newOwnerUserId
        }),
      {
        body: transferOwnershipBodySchema,
        response: {
          200: transferOwnershipResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Workspace Member'],
          summary: 'Pindahkan kepemilikan',
          description: 'Hanya owner. Target harus anggota aktif. Owner lama menjadi admin dan target menjadi owner dalam satu transaksi. Workspace tetap memiliki tepat satu owner.',
          security: SECURITY
        }
      }
    );
}
