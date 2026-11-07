import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { CreateWorkspace } from '../../application/use-cases/create-workspace';
import type { ListWorkspaces } from '../../application/use-cases/list-workspaces';
import type { GetWorkspace } from '../../application/use-cases/get-workspace';
import type { UpdateWorkspace } from '../../application/use-cases/update-workspace';
import type { ArchiveWorkspace } from '../../application/use-cases/archive-workspace';
import {
  archiveWorkspaceResponseSchema,
  createWorkspaceBodySchema,
  createWorkspaceResponseSchema,
  errorResponseSchema,
  listWorkspacesQuerySchema,
  listWorkspacesResponseSchema,
  updateWorkspaceBodySchema,
  workspaceItemSchema,
  workspaceParamSchema
} from './workspace.schemas';

export interface WorkspaceRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly createWorkspace: CreateWorkspace;
  readonly listWorkspaces: ListWorkspaces;
  readonly getWorkspace: GetWorkspace;
  readonly updateWorkspace: UpdateWorkspace;
  readonly archiveWorkspace: ArchiveWorkspace;
}

export function createWorkspaceRoutes({
  getCurrentUser,
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  archiveWorkspace
}: WorkspaceRoutesDependencies) {
  return new Elysia({ prefix: '/api/v1/workspaces' })
    .use(createAuthGuard(getCurrentUser))
    .post(
      '',
      async ({ body, user, set }) => {
        const workspace = await createWorkspace.execute({
          userId: user.id,
          name: body.name,
          description: body.description ?? undefined
        });

        set.status = 201;
        return { workspace };
      },
      {
        body: createWorkspaceBodySchema,
        response: {
          201: createWorkspaceResponseSchema,
          401: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Workspace'],
          summary: 'Buat Workspace Baru',
          description: 'Membuat workspace baru dan menetapkan pembuat sebagai owner.',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .get(
      '',
      async ({ query, user }) => {
        const result = await listWorkspaces.execute({
          userId: user.id,
          limit: query.limit !== undefined ? Number(query.limit) : undefined,
          offset: query.offset !== undefined ? Number(query.offset) : undefined
        });

        return {
          items: result.items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            role: item.role,
            createdAt: item.createdAt
          })),
          pagination: {
            limit: result.pagination.limit,
            offset: result.pagination.offset,
            total: result.pagination.total
          }
        };
      },
      {
        query: listWorkspacesQuerySchema,
        response: {
          200: listWorkspacesResponseSchema,
          401: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Workspace'],
          summary: 'Daftar Workspace Pengguna',
          description: 'Mengambil seluruh workspace aktif di mana pengguna terdaftar sebagai member (termasuk owner).',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .get(
      '/:workspaceId',
      async ({ params, user }) => {
        const workspace = await getWorkspace.execute({
          workspaceId: params.workspaceId,
          userId: user.id
        });

        return { workspace };
      },
      {
        params: workspaceParamSchema,
        response: {
          200: t.Object({ workspace: workspaceItemSchema }),
          401: errorResponseSchema,
          404: errorResponseSchema
        },
        detail: {
          tags: ['Workspace'],
          summary: 'Detail Workspace',
          description: 'Mengambil detail workspace berdasarkan ID. Hanya anggota yang dapat mengakses.',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .patch(
      '/:workspaceId',
      async ({ params, body, user }) => {
        const workspace = await updateWorkspace.execute({
          workspaceId: params.workspaceId,
          userId: user.id,
          name: body.name,
          description: body.description
        });

        return { workspace };
      },
      {
        params: workspaceParamSchema,
        body: updateWorkspaceBodySchema,
        response: {
          200: t.Object({ workspace: workspaceItemSchema }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Workspace'],
          summary: 'Perbarui Workspace',
          description: 'Memperbarui nama atau deskripsi workspace. Hanya owner yang berhak.',
          security: [{ bearerAuth: [] }]
        }
      }
    )
    .post(
      '/:workspaceId/archive',
      async ({ params, user }) => {
        return await archiveWorkspace.execute({
          workspaceId: params.workspaceId,
          userId: user.id
        });
      },
      {
        params: workspaceParamSchema,
        response: {
          200: archiveWorkspaceResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        },
        detail: {
          tags: ['Workspace'],
          summary: 'Arsipkan Workspace',
          description: 'Mengarsipkan workspace secara lunak (soft archive). Hanya owner yang berhak.',
          security: [{ bearerAuth: [] }]
        }
      }
    );
}
