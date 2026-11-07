import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';

export { errorResponseSchema };

export const memberSchema = t.Object(
  {
    user: t.Object({
      id: t.String({ format: 'uuid' }),
      email: t.String(),
      displayName: t.String()
    }),
    membership: t.Object({
      role: t.String({ enum: ['owner', 'admin', 'member'] }),
      joinedAt: t.Date()
    })
  },
  { title: 'WorkspaceMember' }
);

export const memberListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  cursor: t.Optional(t.String({ maxLength: 2048, description: 'Cursor opaque. Urutan joinedAt DESC, userId DESC.' })),
  role: t.Optional(t.String({ enum: ['owner', 'admin', 'member'] }))
});

export const memberListResponseSchema = t.Object({
  items: t.Array(memberSchema),
  pagination: t.Object({
    limit: t.Number(),
    hasMore: t.Boolean(),
    nextCursor: t.Union([t.String(), t.Null()])
  })
});

export const memberResponseSchema = t.Object({ member: memberSchema });

export const changeRoleBodySchema = t.Object(
  { role: t.String({ enum: ['admin', 'member'], examples: ['admin'] }) },
  {
    additionalProperties: false,
    description: 'Role owner tidak dapat diberikan di endpoint ini.'
  }
);

export const transferOwnershipBodySchema = t.Object(
  { newOwnerUserId: t.String({ format: 'uuid' }) },
  { additionalProperties: false }
);

export const transferOwnershipResponseSchema = t.Object({
  workspace: t.Object({ id: t.String({ format: 'uuid' }) }),
  ownership: t.Object({
    previousOwner: t.Object({ userId: t.String({ format: 'uuid' }), role: t.Literal('admin') }),
    newOwner: t.Object({ userId: t.String({ format: 'uuid' }), role: t.Literal('owner') })
  })
});
