import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';

export { errorResponseSchema };

const invitationSchema = t.Object(
  {
    id: t.String({ format: 'uuid' }),
    workspaceId: t.String({ format: 'uuid' }),
    email: t.String(),
    role: t.String({ enum: ['admin', 'member'] }),
    status: t.String({ enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'] }),
    deliveryStatus: t.String({ enum: ['pending', 'sent', 'failed'] }),
    expiresAt: t.Date(),
    createdAt: t.Date()
  },
  { title: 'WorkspaceInvitation', description: 'Undangan tanpa token mentah maupun hash.' }
);

export const createInvitationBodySchema = t.Object(
  {
    email: t.String({ minLength: 3, maxLength: 320, examples: ['friend@example.com'] }),
    role: t.String({ enum: ['admin', 'member'], examples: ['member'] })
  },
  { additionalProperties: false, title: 'CreateInvitationInput' }
);

export const invitationResponseSchema = t.Object({ invitation: invitationSchema });

export const invitationListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  cursor: t.Optional(t.String({ maxLength: 2048, description: 'Cursor opaque dari nextCursor.' })),
  status: t.Optional(t.String({ enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'] })),
  role: t.Optional(t.String({ enum: ['admin', 'member'] }))
});

export const invitationListResponseSchema = t.Object({
  items: t.Array(invitationSchema),
  pagination: t.Object({
    limit: t.Number(),
    hasMore: t.Boolean(),
    nextCursor: t.Union([t.String(), t.Null()])
  })
});

export const myInvitationSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  workspace: t.Object({ id: t.String({ format: 'uuid' }), name: t.String() }),
  inviter: t.Object({ id: t.String({ format: 'uuid' }), displayName: t.String() }),
  role: t.String({ enum: ['admin', 'member'] }),
  status: t.String({ enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'] }),
  expiresAt: t.Date()
});

export const myInvitationListQuerySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  cursor: t.Optional(t.String({ maxLength: 2048 })),
  status: t.Optional(t.String({ enum: ['pending', 'accepted', 'declined', 'revoked', 'expired'] }))
});

export const myInvitationListResponseSchema = t.Object({
  items: t.Array(myInvitationSchema),
  pagination: t.Object({
    limit: t.Number(),
    hasMore: t.Boolean(),
    nextCursor: t.Union([t.String(), t.Null()])
  })
});

export const invitationTokenBodySchema = t.Object(
  {
    token: t.String({
      minLength: 32,
      maxLength: 512,
      description: 'Token mentah dari fragment URL. Jangan kirim lewat query string.'
    })
  },
  { additionalProperties: false }
);

export const membershipResponseSchema = t.Object({
  membership: t.Object({
    workspaceId: t.String({ format: 'uuid' }),
    userId: t.String({ format: 'uuid' }),
    role: t.String(),
    joinedAt: t.Date()
  })
});

export const declinedInvitationResponseSchema = t.Object({
  invitation: t.Object({
    id: t.String({ format: 'uuid' }),
    workspaceId: t.String({ format: 'uuid' }),
    email: t.String(),
    role: t.String(),
    status: t.String(),
    deliveryStatus: t.String(),
    expiresAt: t.Date(),
    createdAt: t.Date()
  })
});
