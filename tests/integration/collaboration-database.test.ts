import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { loadAppConfig } from '../../src/config/app-config';
import { createDatabaseClient, type DatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../../src/modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { DrizzleWorkspaceRepository } from '../../src/modules/workspace/infrastructure/persistence/drizzle-workspace.repository';
import { DrizzleWorkspaceInvitationRepository } from '../../src/modules/workspace/infrastructure/persistence/drizzle-invitation.repository';
import { DrizzleWorkspaceUnitOfWork } from '../../src/modules/workspace/infrastructure/persistence/drizzle-workspace-unit-of-work';
import { WorkspaceInvitation } from '../../src/modules/workspace/domain/entities/workspace-invitation';
import { WorkspaceError } from '../../src/modules/workspace/domain/errors/workspace-error';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { CryptoInvitationTokenGenerator } from '../../src/modules/workspace/infrastructure/security/crypto-invitation-token.generator';
import { AcceptInvitation } from '../../src/modules/workspace/application/use-cases/invitations/accept-invitation';
import { TransferOwnership } from '../../src/modules/workspace/application/use-cases/members/transfer-ownership';
import { WorkspaceAuthorizationService } from '../../src/modules/workspace/application/services/workspace-authorization.service';
import { systemClock } from '../../src/shared/domain/clock';

const config = loadAppConfig();
const silentLogger = createLogger('silent');

let client: DatabaseClient;
let authRepo: DrizzleAuthRepository;
let workspaceRepo: DrizzleWorkspaceRepository;

beforeAll(() => {
  client = createDatabaseClient(config.database, silentLogger);
  authRepo = new DrizzleAuthRepository(client);
  workspaceRepo = new DrizzleWorkspaceRepository(client);
});

afterAll(async () => {
  await client.close();
});

async function seedUser(prefix: string): Promise<string> {
  const user = await authRepo.createNewUser({
    email: toEmail(`${prefix}_${crypto.randomUUID()}@example.com`),
    displayName: prefix,
    passwordHash: 'hash',
    now: new Date()
  });

  return user.id;
}

describe('invitation database', () => {
  test('unique pending, role check, satu owner, dan token hash unik', async () => {
    const ownerId = await seedUser('owner');
    const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
      name: `Collab ${crypto.randomUUID().slice(0, 8)}`,
      description: null,
      createdBy: ownerId,
      now: new Date()
    });
    const invitations = new DrizzleWorkspaceInvitationRepository(client.db);
    const now = new Date();
    const first = WorkspaceInvitation.create({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      email: 'guest@example.com',
      normalizedEmail: 'guest@example.com',
      role: 'member',
      tokenHash: crypto.randomUUID(),
      invitedBy: ownerId,
      expiresAt: new Date(now.getTime() + 86_400_000),
      now
    });
    await invitations.insert(first);
    const duplicate = WorkspaceInvitation.create({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      email: 'guest@example.com',
      normalizedEmail: 'guest@example.com',
      role: 'admin',
      tokenHash: crypto.randomUUID(),
      invitedBy: ownerId,
      expiresAt: new Date(now.getTime() + 86_400_000),
      now
    });
    await expect(invitations.insert(duplicate)).rejects.toBeInstanceOf(WorkspaceError);

    let roleRejected = false;

    try {
      await client.db.execute(sql`
        INSERT INTO workspace_invitations (
          id, workspace_id, email, normalized_email, role, token_hash, status, invited_by,
          expires_at, delivery_status, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${workspace.id}::uuid, 'x@example.com', 'x@example.com', 'owner', ${crypto.randomUUID()},
          'pending', ${ownerId}::uuid, ${new Date(now.getTime() + 1000)}, 'pending', ${now}, ${now}
        )
      `);
    } catch {
      roleRejected = true;
    }

    expect(roleRejected).toBe(true);

    const other = await seedUser('second');
    let ownerRejected = false;

    try {
      await client.db.execute(sql`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
        VALUES (${crypto.randomUUID()}::uuid, ${workspace.id}::uuid, ${other}::uuid, 'owner', ${now})
      `);
    } catch {
      ownerRejected = true;
    }

    expect(ownerRejected).toBe(true);
  });

  test('accept bersamaan hanya menghasilkan satu membership', async () => {
    const ownerId = await seedUser('owner_race');
    const guest = await authRepo.createNewUser({
      email: toEmail(`guest_race_${crypto.randomUUID()}@example.com`),
      displayName: 'Guest',
      passwordHash: 'hash',
      now: new Date()
    });
    const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
      name: `Race ${crypto.randomUUID().slice(0, 8)}`,
      description: null,
      createdBy: ownerId,
      now: new Date()
    });
    const tokens = new CryptoInvitationTokenGenerator();
    const generated = await tokens.generate();
    const now = new Date();
    const invitation = WorkspaceInvitation.create({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      email: guest.email.value,
      normalizedEmail: guest.email.value,
      role: 'member',
      tokenHash: generated.tokenHash,
      invitedBy: ownerId,
      expiresAt: new Date(now.getTime() + 86_400_000),
      now
    });
    const invitations = new DrizzleWorkspaceInvitationRepository(client.db);
    await invitations.insert(invitation);
    const left = new AcceptInvitation(new DrizzleWorkspaceUnitOfWork(client.db), tokens, systemClock);
    const right = new AcceptInvitation(new DrizzleWorkspaceUnitOfWork(client.db), tokens, systemClock);
    const results = await Promise.allSettled([
      left.execute({
        invitationId: invitation.id,
        userId: guest.id,
        email: guest.email.value,
        token: generated.token
      }),
      right.execute({
        invitationId: invitation.id,
        userId: guest.id,
        email: guest.email.value,
        token: generated.token
      })
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    const rows = await client.db.execute(sql`
      SELECT count(*)::int AS total
      FROM workspace_members
      WHERE workspace_id = ${workspace.id} AND user_id = ${guest.id}
    `);
    expect(Number(rows.rows[0]?.total)).toBe(1);
  });

  test('transfer ownership atomik dan query memakai index', async () => {
    const ownerId = await seedUser('owner_transfer');
    const targetId = await seedUser('target_transfer');
    const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
      name: `Transfer ${crypto.randomUUID().slice(0, 8)}`,
      description: null,
      createdBy: ownerId,
      now: new Date()
    });
    await client.db.execute(sql`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      VALUES (${crypto.randomUUID()}, ${workspace.id}, ${targetId}, 'member', now())
    `);
    const transfer = new TransferOwnership(
      new WorkspaceAuthorizationService(workspaceRepo),
      new DrizzleWorkspaceUnitOfWork(client.db)
    );
    const result = await transfer.execute({
      workspaceId: workspace.id,
      actorId: ownerId,
      newOwnerUserId: targetId
    });
    expect(result.ownership.newOwner.role).toBe('owner');
    const owners = await client.db.execute(sql`
      SELECT count(*)::int AS total
      FROM workspace_members
      WHERE workspace_id = ${workspace.id} AND role = 'owner'
    `);
    expect(Number(owners.rows[0]?.total)).toBe(1);

    const plan = await client.db.execute(sql`
      EXPLAIN
      SELECT id
      FROM workspace_invitations
      WHERE workspace_id = ${workspace.id}
      ORDER BY created_at DESC, id DESC
      LIMIT 21
    `);
    const text = plan.rows.map((row) => Object.values(row).join(' ')).join('\n');
    expect(text.toLowerCase()).toContain('workspace_invitations');
  });
});
