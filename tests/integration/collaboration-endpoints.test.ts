import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/bootstrap/create-app';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { FixedClock } from '../../src/shared/domain/clock';
import { GetCurrentUser } from '../../src/modules/auth/application/use-cases/get-current-user';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { WorkspaceAuthorizationService } from '../../src/modules/workspace/application/services/workspace-authorization.service';
import { CreateInvitation } from '../../src/modules/workspace/application/use-cases/invitations/create-invitation';
import { ListInvitations } from '../../src/modules/workspace/application/use-cases/invitations/list-invitations';
import { ListMyInvitations } from '../../src/modules/workspace/application/use-cases/invitations/list-my-invitations';
import { AcceptInvitation } from '../../src/modules/workspace/application/use-cases/invitations/accept-invitation';
import { DeclineInvitation } from '../../src/modules/workspace/application/use-cases/invitations/decline-invitation';
import { ResendInvitation } from '../../src/modules/workspace/application/use-cases/invitations/resend-invitation';
import { RevokeInvitation } from '../../src/modules/workspace/application/use-cases/invitations/revoke-invitation';
import { ListMembers } from '../../src/modules/workspace/application/use-cases/members/list-members';
import { GetMember } from '../../src/modules/workspace/application/use-cases/members/get-member';
import { ChangeMemberRole } from '../../src/modules/workspace/application/use-cases/members/change-member-role';
import { RemoveMember } from '../../src/modules/workspace/application/use-cases/members/remove-member';
import { LeaveWorkspace } from '../../src/modules/workspace/application/use-cases/members/leave-workspace';
import { TransferOwnership } from '../../src/modules/workspace/application/use-cases/members/transfer-ownership';
import { CreateWorkspace } from '../../src/modules/workspace/application/use-cases/create-workspace';
import { ListWorkspaces } from '../../src/modules/workspace/application/use-cases/list-workspaces';
import { GetWorkspace } from '../../src/modules/workspace/application/use-cases/get-workspace';
import { UpdateWorkspace } from '../../src/modules/workspace/application/use-cases/update-workspace';
import { ArchiveWorkspace } from '../../src/modules/workspace/application/use-cases/archive-workspace';
import { Base64UrlCollaborationCursorCodec } from '../../src/modules/workspace/infrastructure/pagination/collaboration-cursor';
import type { WorkspaceUserDirectory } from '../../src/modules/workspace/application/ports/workspace-user-directory';
import { buildTestAppConfig } from '../helpers/test-app-config';
import { connectedProbe } from '../helpers/test-app';
import { InMemoryAuthRepository } from '../helpers/in-memory-auth-repository';
import { InMemoryWorkspaceRepository } from '../helpers/in-memory-workspace-repository';
import { JoseAccessTokenService } from '../../src/modules/auth/infrastructure/security/jose-access-token.service';
import {
  FakeInvitationEmailSender,
  InMemoryInvitationRepository,
  InMemoryMemberRepository,
  InMemoryWorkspaceUnitOfWork,
  SequenceInvitationTokenGenerator
} from '../helpers/in-memory-collaboration';
import {
  addWorkspaceMember,
  authHeader,
  createAuthenticatedUser,
  createWorkspaceForUser,
  jsonHeaders,
  TEST_NOW
} from '../helpers/todo-test-app';

function buildApp() {
  const config = buildTestAppConfig();
  const clock = new FixedClock(TEST_NOW);
  const authRepo = new InMemoryAuthRepository();
  const workspaceRepo = new InMemoryWorkspaceRepository();
  const invitations = new InMemoryInvitationRepository();
  const members = new InMemoryMemberRepository(workspaceRepo);
  const uow = new InMemoryWorkspaceUnitOfWork(workspaceRepo, invitations, members);
  const tokens = new SequenceInvitationTokenGenerator();
  const email = new FakeInvitationEmailSender();
  const cursor = new Base64UrlCollaborationCursorCodec();
  const authorization = new WorkspaceAuthorizationService(workspaceRepo);
  const users: WorkspaceUserDirectory = {
    async findByNormalizedEmail(normalizedEmail) {
      const user = authRepo.users.find((item) => item.email.value === normalizedEmail);
      return user ? { id: user.id, email: user.email.value, displayName: user.displayName } : null;
    },
    async findByIds(userIds) {
      return authRepo.users
        .filter((user) => userIds.includes(user.id))
        .map((user) => ({ id: user.id, email: user.email.value, displayName: user.displayName }));
    }
  };
  const accessTokenService = new JoseAccessTokenService({
    secret: config.auth.jwtSecret,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    clock
  });
  const getCurrentUser = new GetCurrentUser(authRepo, authRepo, accessTokenService, clock);
  const app = createApp({
    config,
    logger: createLogger('silent'),
    readiness: new CheckServiceReadiness(connectedProbe),
    workspace: {
      getCurrentUser,
      createWorkspace: new CreateWorkspace(workspaceRepo, clock),
      listWorkspaces: new ListWorkspaces(workspaceRepo),
      getWorkspace: new GetWorkspace(workspaceRepo),
      updateWorkspace: new UpdateWorkspace(workspaceRepo, clock),
      archiveWorkspace: new ArchiveWorkspace(workspaceRepo, clock),
      invitations: {
        getCurrentUser,
        createInvitation: new CreateInvitation(
          authorization,
          uow,
          invitations,
          users,
          tokens,
          email,
          clock,
          config.webAppUrl,
          config.invitationTokenTtlSeconds
        ),
        listInvitations: new ListInvitations(authorization, invitations, cursor, clock),
        listMyInvitations: new ListMyInvitations(invitations, workspaceRepo, users, cursor, clock),
        resendInvitation: new ResendInvitation(
          authorization,
          uow,
          invitations,
          tokens,
          email,
          clock,
          config.webAppUrl,
          config.invitationTokenTtlSeconds
        ),
        revokeInvitation: new RevokeInvitation(authorization, uow, clock),
        acceptInvitation: new AcceptInvitation(uow, tokens, clock),
        declineInvitation: new DeclineInvitation(uow, tokens, clock)
      },
      members: {
        getCurrentUser,
        listMembers: new ListMembers(authorization, members, users, cursor),
        getMember: new GetMember(authorization, members, users),
        changeMemberRole: new ChangeMemberRole(authorization, uow, users),
        removeMember: new RemoveMember(authorization, uow),
        leaveWorkspace: new LeaveWorkspace(authorization, uow),
        transferOwnership: new TransferOwnership(authorization, uow)
      }
    }
  });

  return { app, authRepo, workspaceRepo, accessTokenService, email, tokens };
}

describe('collaboration HTTP', () => {
  test('undangan, anggota, transfer, dan OpenAPI', async () => {
    const fixture = buildApp();
    const owner = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'owner@example.com');
    const friend = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'friend@example.com');
    const workspace = await createWorkspaceForUser(fixture.workspaceRepo, owner.userId, 'Development Team');
    const base = `http://test.local/api/v1/workspaces/${workspace.id}`;

    const unauthenticated = await fixture.app.handle(
      new Request(`${base}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'friend@example.com', role: 'member' })
      })
    );
    expect(unauthenticated.status).toBe(401);

    const created = await fixture.app.handle(
      new Request(`${base}/invitations`, {
        method: 'POST',
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ email: 'friend@example.com', role: 'member' })
      })
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { invitation: { id: string; deliveryStatus: string } };
    expect(createdBody.invitation.deliveryStatus).toBe('sent');
    expect(JSON.stringify(createdBody)).not.toContain('tokenHash');
    expect(JSON.stringify(createdBody)).not.toContain(fixture.tokens.issued[0] ?? 'missing-token');

    const mine = await fixture.app.handle(
      new Request('http://test.local/api/v1/invitations', { headers: authHeader(friend.token) })
    );
    expect(mine.status).toBe(200);
    const mineBody = (await mine.json()) as { items: Array<{ workspace: { name: string } }> };
    expect(mineBody.items[0]?.workspace.name).toBe('Development Team');

    const accepted = await fixture.app.handle(
      new Request(`http://test.local/api/v1/invitations/${createdBody.invitation.id}/accept`, {
        method: 'POST',
        headers: jsonHeaders(friend.token),
        body: JSON.stringify({ token: fixture.tokens.issued[0] })
      })
    );
    expect(accepted.status).toBe(200);

    const members = await fixture.app.handle(
      new Request(`${base}/members`, { headers: authHeader(friend.token) })
    );
    expect(members.status).toBe(200);

    const promoted = await fixture.app.handle(
      new Request(`${base}/members/${friend.userId}`, {
        method: 'PATCH',
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ role: 'admin' })
      })
    );
    expect(promoted.status).toBe(200);

    const transfer = await fixture.app.handle(
      new Request(`${base}/transfer-ownership`, {
        method: 'POST',
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ newOwnerUserId: friend.userId })
      })
    );
    expect(transfer.status).toBe(200);
    const transferBody = (await transfer.json()) as { ownership: { newOwner: { role: string } } };
    expect(transferBody.ownership.newOwner.role).toBe('owner');

    const ownerLeave = await fixture.app.handle(
      new Request(`${base}/leave`, { method: 'POST', headers: authHeader(owner.token) })
    );
    expect(ownerLeave.status).toBe(204);

    const spec = await fixture.app.handle(new Request('http://test.local/openapi/json'));
    expect(spec.status).toBe(200);
    const document = (await spec.json()) as { paths: Record<string, unknown> };
    expect(document.paths['/api/v1/workspaces/{workspaceId}/invitations']).toBeDefined();
    expect(document.paths['/api/v1/invitations/{invitationId}/accept']).toBeDefined();
    expect(document.paths['/api/v1/workspaces/{workspaceId}/transfer-ownership']).toBeDefined();
    expect(JSON.stringify(document.paths['/api/v1/invitations/{invitationId}/accept'])).not.toContain('tokenHash');
  });

  test('member yang dihapus tidak lagi melihat workspace todo', async () => {
    const fixture = buildApp();
    const owner = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'owner2@example.com');
    const member = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'member2@example.com');
    const workspace = await createWorkspaceForUser(fixture.workspaceRepo, owner.userId);
    addWorkspaceMember(fixture.workspaceRepo, workspace.id, member.userId);
    const path = `http://test.local/api/v1/workspaces/${workspace.id}/members/${member.userId}`;
    const removed = await fixture.app.handle(
      new Request(path, { method: 'DELETE', headers: authHeader(owner.token) })
    );
    expect(removed.status).toBe(204);
    const listed = await fixture.app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspace.id}/members`, {
        headers: authHeader(member.token)
      })
    );
    expect(listed.status).toBe(404);
  });

  test('decline mengembalikan status declined tanpa token', async () => {
    const fixture = buildApp();
    const owner = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'owner3@example.com');
    const guest = await createAuthenticatedUser(fixture.authRepo, fixture.accessTokenService, 'guest@example.com');
    const workspace = await createWorkspaceForUser(fixture.workspaceRepo, owner.userId);
    const created = await fixture.app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspace.id}/invitations`, {
        method: 'POST',
        headers: jsonHeaders(owner.token),
        body: JSON.stringify({ email: toEmail('guest@example.com').value, role: 'member' })
      })
    );
    const body = (await created.json()) as { invitation: { id: string } };
    const declined = await fixture.app.handle(
      new Request(`http://test.local/api/v1/invitations/${body.invitation.id}/decline`, {
        method: 'POST',
        headers: jsonHeaders(guest.token),
        body: JSON.stringify({ token: fixture.tokens.issued.at(-1) })
      })
    );
    expect(declined.status).toBe(200);
    const declinedBody = (await declined.json()) as { invitation: { status: string } };
    expect(declinedBody.invitation.status).toBe('declined');
    expect(JSON.stringify(declinedBody)).not.toContain(fixture.tokens.issued.at(-1) ?? 'missing');
  });
});
