import { describe, expect, test } from 'bun:test';
import { FixedClock } from '../../../src/shared/domain/clock';
import { WorkspaceInvitation } from '../../../src/modules/workspace/domain/entities/workspace-invitation';
import { InvitationStatus } from '../../../src/modules/workspace/domain/enums/invitation-status';
import { WorkspaceRole } from '../../../src/modules/workspace/domain/enums/workspace-role';
import { WorkspaceError } from '../../../src/modules/workspace/domain/errors/workspace-error';
import { WorkspaceAction, WorkspaceAuthorizationPolicy } from '../../../src/modules/workspace/domain/policies/workspace-authorization.policy';
import { toInvitationEmail } from '../../../src/modules/workspace/domain/value-objects/invitation-email';
import { WorkspaceAuthorizationService } from '../../../src/modules/workspace/application/services/workspace-authorization.service';
import { CreateInvitation } from '../../../src/modules/workspace/application/use-cases/invitations/create-invitation';
import { AcceptInvitation } from '../../../src/modules/workspace/application/use-cases/invitations/accept-invitation';
import { DeclineInvitation } from '../../../src/modules/workspace/application/use-cases/invitations/decline-invitation';
import { ResendInvitation } from '../../../src/modules/workspace/application/use-cases/invitations/resend-invitation';
import { RevokeInvitation } from '../../../src/modules/workspace/application/use-cases/invitations/revoke-invitation';
import { ListInvitations } from '../../../src/modules/workspace/application/use-cases/invitations/list-invitations';
import { ListMyInvitations } from '../../../src/modules/workspace/application/use-cases/invitations/list-my-invitations';
import { ChangeMemberRole } from '../../../src/modules/workspace/application/use-cases/members/change-member-role';
import { RemoveMember } from '../../../src/modules/workspace/application/use-cases/members/remove-member';
import { LeaveWorkspace } from '../../../src/modules/workspace/application/use-cases/members/leave-workspace';
import { TransferOwnership } from '../../../src/modules/workspace/application/use-cases/members/transfer-ownership';
import { ListMembers } from '../../../src/modules/workspace/application/use-cases/members/list-members';
import { renderInvitationEmail } from '../../../src/modules/workspace/infrastructure/email/invitation-email.template';
import { CryptoInvitationTokenGenerator } from '../../../src/modules/workspace/infrastructure/security/crypto-invitation-token.generator';
import { Base64UrlCollaborationCursorCodec } from '../../../src/modules/workspace/infrastructure/pagination/collaboration-cursor';
import { buildInvitationUrl } from '../../../src/modules/workspace/application/services/invitation-mailer';
import { InMemoryWorkspaceRepository } from '../../helpers/in-memory-workspace-repository';
import {
  FakeInvitationEmailSender,
  InMemoryInvitationRepository,
  InMemoryMemberRepository,
  InMemoryWorkspaceUnitOfWork,
  InMemoryWorkspaceUserDirectory,
  SequenceInvitationTokenGenerator
} from '../../helpers/in-memory-collaboration';

const NOW = new Date('2026-11-07T05:00:00.000Z');
const TTL = 604_800;

function ids() {
  return {
    owner: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    member: crypto.randomUUID(),
    invitee: crypto.randomUUID()
  };
}

function harness(now = NOW) {
  const people = ids();
  const users = [
    { id: people.owner, email: 'owner@example.com', displayName: 'Owner' },
    { id: people.admin, email: 'admin@example.com', displayName: 'Admin' },
    { id: people.member, email: 'member@example.com', displayName: 'Member' },
    { id: people.invitee, email: 'friend@example.com', displayName: 'Friend' }
  ];
  const workspaces = new InMemoryWorkspaceRepository();
  const clock = new FixedClock(now);
  const created = workspaces.workspaces;
  void created;
  const workspace = {
    id: crypto.randomUUID(),
    name: 'Development Team',
    description: null,
    createdBy: people.owner,
    createdAt: now,
    updatedAt: now,
    archivedAt: null as Date | null
  };
  workspaces.workspaces.push(workspace);
  workspaces.members.push(
    { id: crypto.randomUUID(), workspaceId: workspace.id, userId: people.owner, role: WorkspaceRole.OWNER, joinedAt: now },
    { id: crypto.randomUUID(), workspaceId: workspace.id, userId: people.admin, role: WorkspaceRole.ADMIN, joinedAt: now },
    { id: crypto.randomUUID(), workspaceId: workspace.id, userId: people.member, role: WorkspaceRole.MEMBER, joinedAt: now }
  );
  const invitations = new InMemoryInvitationRepository();
  const members = new InMemoryMemberRepository(workspaces);
  const uow = new InMemoryWorkspaceUnitOfWork(workspaces, invitations, members);
  const directory = new InMemoryWorkspaceUserDirectory(users);
  const tokens = new SequenceInvitationTokenGenerator();
  const email = new FakeInvitationEmailSender();
  const authorization = new WorkspaceAuthorizationService(workspaces);
  const cursor = new Base64UrlCollaborationCursorCodec();
  const create = new CreateInvitation(authorization, uow, invitations, directory, tokens, email, clock, 'http://localhost:3000', TTL);

  return {
    people,
    users,
    workspace,
    workspaces,
    invitations,
    members,
    uow,
    directory,
    tokens,
    email,
    clock,
    authorization,
    cursor,
    create,
    accept: new AcceptInvitation(uow, tokens, clock),
    decline: new DeclineInvitation(uow, tokens, clock),
    resend: new ResendInvitation(authorization, uow, invitations, tokens, email, clock, 'http://localhost:3000', TTL),
    revoke: new RevokeInvitation(authorization, uow, clock),
    list: new ListInvitations(authorization, invitations, cursor, clock),
    mine: new ListMyInvitations(invitations, workspaces, directory, cursor, clock),
    changeRole: new ChangeMemberRole(authorization, uow, directory),
    remove: new RemoveMember(authorization, uow),
    leave: new LeaveWorkspace(authorization, uow),
    transfer: new TransferOwnership(authorization, uow),
    listMembers: new ListMembers(authorization, members, directory, cursor)
  };
}

describe('invitation domain', () => {
  test('menolak role owner dan email tidak valid', () => {
    expect(toInvitationEmail('  Friend@Example.com ')).toEqual({
      email: 'Friend@Example.com',
      normalizedEmail: 'friend@example.com'
    });
    expect(() => toInvitationEmail('bukan-email')).toThrow(WorkspaceError);
    expect(() =>
      WorkspaceInvitation.create({
        id: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
        email: 'a@b.co',
        normalizedEmail: 'a@b.co',
        role: 'owner',
        tokenHash: 'abc',
        invitedBy: crypto.randomUUID(),
        expiresAt: new Date(NOW.getTime() + 1000),
        now: NOW
      })
    ).toThrow(WorkspaceError);
  });

  test('status transisi dan hash token', () => {
    const invitation = WorkspaceInvitation.create({
      id: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      email: 'a@b.co',
      normalizedEmail: 'a@b.co',
      role: 'member',
      tokenHash: 'hash-1',
      invitedBy: crypto.randomUUID(),
      expiresAt: new Date(NOW.getTime() + 1000),
      now: NOW
    });
    expect(invitation.effectiveStatus(NOW)).toBe(InvitationStatus.PENDING);
    expect(invitation.effectiveStatus(new Date(NOW.getTime() + 1000)).toString()).toBe('expired');
    expect(invitation.matchesTokenHash('hash-1')).toBe(true);
    expect(invitation.matchesTokenHash('lain')).toBe(false);
    const accepted = invitation.accept(crypto.randomUUID(), NOW);
    expect(() => accepted.accept(crypto.randomUUID(), NOW)).toThrow(WorkspaceError);
    expect(() => accepted.decline(NOW)).toThrow(WorkspaceError);
    expect(() => invitation.revoke(new Date(NOW.getTime() + 5000))).toThrow(WorkspaceError);
  });
});

describe('create invitation', () => {
  test('owner mengundang member dan admin', async () => {
    const env = harness();
    const memberInvite = await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.owner,
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner',
      email: 'Friend@Example.com',
      role: 'member'
    });
    expect(memberInvite.invitation.deliveryStatus).toBe('sent');
    expect(JSON.stringify(memberInvite)).not.toContain(env.tokens.issued[0]);
    expect(env.email.sent[0]?.invitationUrl).toContain('#token=');
    expect(env.email.sent[0]?.invitationUrl).not.toContain('?token=');
    const adminInvite = await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.owner,
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner',
      email: 'new-admin@example.com',
      role: 'admin'
    });
    expect(adminInvite.invitation.role).toBe('admin');
  });

  test('admin hanya boleh mengundang member', async () => {
    const env = harness();
    const created = await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.admin,
      inviterEmail: 'admin@example.com',
      inviterName: 'Admin',
      email: 'friend@example.com',
      role: 'member'
    });
    expect(created.invitation.role).toBe('member');
    await expect(
      env.create.execute({
        workspaceId: env.workspace.id,
        userId: env.people.admin,
        inviterEmail: 'admin@example.com',
        inviterName: 'Admin',
        email: 'other@example.com',
        role: 'admin'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PERMISSION_DENIED' });
  });

  test('menolak member, diri sendiri, anggota, duplikat, archived, dan workspace asing', async () => {
    const env = harness();
    await expect(
      env.create.execute({
        workspaceId: env.workspace.id,
        userId: env.people.member,
        inviterEmail: 'member@example.com',
        inviterName: 'Member',
        email: 'friend@example.com',
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PERMISSION_DENIED' });
    await expect(
      env.create.execute({
        workspaceId: env.workspace.id,
        userId: env.people.owner,
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner',
        email: 'owner@example.com',
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      env.create.execute({
        workspaceId: env.workspace.id,
        userId: env.people.owner,
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner',
        email: 'admin@example.com',
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MEMBER_ALREADY_EXISTS' });
    await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.owner,
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner',
      email: 'friend@example.com',
      role: 'member'
    });
    await expect(
      env.create.execute({
        workspaceId: env.workspace.id,
        userId: env.people.owner,
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner',
        email: 'friend@example.com',
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'INVITATION_ALREADY_PENDING' });
    env.workspace.archivedAt = NOW;
    await expect(
      env.create.execute({
        workspaceId: env.workspace.id,
        userId: env.people.owner,
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner',
        email: 'fresh@example.com',
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_ACCESS_DENIED' });
    await expect(
      env.create.execute({
        workspaceId: crypto.randomUUID(),
        userId: env.people.owner,
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner',
        email: 'fresh@example.com',
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_ACCESS_DENIED' });
  });

  test('kegagalan email menyimpan undangan dengan delivery failed', async () => {
    const env = harness();
    env.email.fail = true;
    const result = await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.owner,
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner',
      email: 'friend@example.com',
      role: 'member'
    });
    expect(result.invitation.status).toBe('pending');
    expect(result.invitation.deliveryStatus).toBe('failed');
    expect(env.invitations.items).toHaveLength(1);
  });
});

describe('accept decline resend revoke', () => {
  async function invite(env: ReturnType<typeof harness>, email = 'friend@example.com') {
    env.email.fail = false;
    const created = await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.owner,
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner',
      email,
      role: 'member'
    });

    return { created, token: env.tokens.issued.at(-1) ?? '' };
  }

  test('accept valid, token salah, email salah, dan token tidak bisa dua kali', async () => {
    const env = harness();
    const { created, token } = await invite(env);
    const accepted = await env.accept.execute({
      invitationId: created.invitation.id,
      userId: env.people.invitee,
      email: 'friend@example.com',
      token
    });
    expect(accepted.membership.role).toBe('member');
    await expect(
      env.accept.execute({
        invitationId: created.invitation.id,
        userId: env.people.invitee,
        email: 'friend@example.com',
        token
      })
    ).rejects.toMatchObject({ code: 'INVITATION_ALREADY_ACCEPTED' });
    const second = await invite(env, 'other@example.com');
    await expect(
      env.accept.execute({
        invitationId: second.created.invitation.id,
        userId: env.people.invitee,
        email: 'friend@example.com',
        token: second.token
      })
    ).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    await expect(
      env.accept.execute({
        invitationId: second.created.invitation.id,
        userId: crypto.randomUUID(),
        email: 'other@example.com',
        token: 'salah'
      })
    ).rejects.toMatchObject({ code: 'INVITATION_TOKEN_INVALID' });
  });

  test('decline, revoke, expiry, dan rotasi token', async () => {
    const env = harness();
    const declined = await invite(env, 'decline@example.com');
    const result = await env.decline.execute({
      invitationId: declined.created.invitation.id,
      email: 'decline@example.com',
      token: declined.token
    });
    expect(result.invitation.status).toBe('declined');
    const again = await env.decline.execute({
      invitationId: declined.created.invitation.id,
      email: 'decline@example.com',
      token: declined.token
    });
    expect(again.invitation.status).toBe('declined');
    await expect(
      env.accept.execute({
        invitationId: declined.created.invitation.id,
        userId: crypto.randomUUID(),
        email: 'decline@example.com',
        token: declined.token
      })
    ).rejects.toMatchObject({ code: 'INVITATION_ALREADY_DECLINED' });

    const revoked = await invite(env, 'revoke@example.com');
    await env.revoke.execute({
      workspaceId: env.workspace.id,
      invitationId: revoked.created.invitation.id,
      userId: env.people.owner
    });
    await env.revoke.execute({
      workspaceId: env.workspace.id,
      invitationId: revoked.created.invitation.id,
      userId: env.people.owner
    });
    await expect(
      env.accept.execute({
        invitationId: revoked.created.invitation.id,
        userId: crypto.randomUUID(),
        email: 'revoke@example.com',
        token: revoked.token
      })
    ).rejects.toMatchObject({ code: 'INVITATION_ALREADY_REVOKED' });

    const active = await invite(env, 'rotate@example.com');
    const old = active.token;
    env.clock.set(new Date(NOW.getTime() + 1000));
    const resent = await env.resend.execute({
      workspaceId: env.workspace.id,
      invitationId: active.created.invitation.id,
      userId: env.people.owner,
      inviterName: 'Owner'
    });
    const next = env.tokens.issued.at(-1) ?? '';
    expect(next).not.toBe(old);
    expect(resent.invitation.expiresAt.getTime()).toBeGreaterThan(active.created.invitation.expiresAt.getTime());
    await expect(
      env.accept.execute({
        invitationId: active.created.invitation.id,
        userId: crypto.randomUUID(),
        email: 'rotate@example.com',
        token: old
      })
    ).rejects.toMatchObject({ code: 'INVITATION_TOKEN_INVALID' });
    const accepted = await env.accept.execute({
      invitationId: active.created.invitation.id,
      userId: crypto.randomUUID(),
      email: 'rotate@example.com',
      token: next
    });
    expect(accepted.membership.role).toBe('member');
  });

  test('undangan kedaluwarsa tidak dapat diterima lalu dapat dikirim ulang', async () => {
    const env = harness();
    const created = await invite(env, 'late@example.com');
    env.clock.set(new Date(NOW.getTime() + TTL * 1000 + 1));
    await expect(
      env.accept.execute({
        invitationId: created.created.invitation.id,
        userId: crypto.randomUUID(),
        email: 'late@example.com',
        token: created.token
      })
    ).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
    const resent = await env.resend.execute({
      workspaceId: env.workspace.id,
      invitationId: created.created.invitation.id,
      userId: env.people.owner,
      inviterName: 'Owner'
    });
    expect(resent.invitation.status).toBe('pending');
  });

  test('admin tidak dapat resend undangan admin atau milik orang lain', async () => {
    const env = harness();
    const adminInvite = await env.create.execute({
      workspaceId: env.workspace.id,
      userId: env.people.owner,
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner',
      email: 'new-admin@example.com',
      role: 'admin'
    });
    await expect(
      env.resend.execute({
        workspaceId: env.workspace.id,
        invitationId: adminInvite.invitation.id,
        userId: env.people.admin,
        inviterName: 'Admin'
      })
    ).rejects.toMatchObject({ code: 'INVITATION_RESEND_NOT_ALLOWED' });
  });
});

describe('members and ownership', () => {
  test('list, ubah role, hapus, dan leave', async () => {
    const env = harness();
    const listed = await env.listMembers.execute({ workspaceId: env.workspace.id, userId: env.people.member, limit: 10 });
    expect(listed.items.map((item) => item.membership.role).sort()).toEqual(['admin', 'member', 'owner']);
    const promoted = await env.changeRole.execute({
      workspaceId: env.workspace.id,
      actorId: env.people.owner,
      memberUserId: env.people.member,
      role: 'admin'
    });
    expect(promoted.member.membership.role).toBe('admin');
    await expect(
      env.changeRole.execute({
        workspaceId: env.workspace.id,
        actorId: env.people.admin,
        memberUserId: env.people.member,
        role: 'member'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PERMISSION_DENIED' });
    await env.changeRole.execute({
      workspaceId: env.workspace.id,
      actorId: env.people.owner,
      memberUserId: env.people.member,
      role: 'member'
    });
    await env.remove.execute({
      workspaceId: env.workspace.id,
      actorId: env.people.admin,
      memberUserId: env.people.member
    });
    expect(await env.workspaces.findMembership(env.workspace.id, env.people.member)).toBeNull();
    await expect(
      env.remove.execute({
        workspaceId: env.workspace.id,
        actorId: env.people.owner,
        memberUserId: env.people.owner
      })
    ).rejects.toMatchObject({ code: 'OWNER_TRANSFER_REQUIRED' });
    await env.leave.execute({ workspaceId: env.workspace.id, userId: env.people.admin });
    await expect(env.leave.execute({ workspaceId: env.workspace.id, userId: env.people.owner })).rejects.toMatchObject({
      code: 'OWNER_TRANSFER_REQUIRED'
    });
  });

  test('transfer ownership membuat tepat satu owner', async () => {
    const env = harness();
    const result = await env.transfer.execute({
      workspaceId: env.workspace.id,
      actorId: env.people.owner,
      newOwnerUserId: env.people.member
    });
    expect(result.ownership.previousOwner.role).toBe('admin');
    expect(result.ownership.newOwner.role).toBe('owner');
    const owners = env.workspaces.members.filter((item) => item.workspaceId === env.workspace.id && item.role === 'owner');
    expect(owners).toHaveLength(1);
    expect(owners[0]?.userId).toBe(env.people.member);
    await expect(
      env.transfer.execute({
        workspaceId: env.workspace.id,
        actorId: env.people.owner,
        newOwnerUserId: env.people.admin
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_PERMISSION_DENIED' });
  });
});

describe('rbac matrix', () => {
  const cases: Array<[WorkspaceRole, WorkspaceAction, boolean]> = [
    [WorkspaceRole.OWNER, WorkspaceAction.INVITE_ADMIN, true],
    [WorkspaceRole.ADMIN, WorkspaceAction.INVITE_ADMIN, false],
    [WorkspaceRole.MEMBER, WorkspaceAction.INVITE_MEMBER, false],
    [WorkspaceRole.ADMIN, WorkspaceAction.INVITE_MEMBER, true],
    [WorkspaceRole.MEMBER, WorkspaceAction.VIEW_MEMBERS, true],
    [WorkspaceRole.ADMIN, WorkspaceAction.CHANGE_MEMBER_ROLE, false],
    [WorkspaceRole.OWNER, WorkspaceAction.TRANSFER_OWNERSHIP, true],
    [WorkspaceRole.ADMIN, WorkspaceAction.TRANSFER_OWNERSHIP, false],
    [WorkspaceRole.MEMBER, WorkspaceAction.REMOVE_MEMBER, false],
    [WorkspaceRole.ADMIN, WorkspaceAction.REMOVE_MEMBER, true],
    [WorkspaceRole.OWNER, WorkspaceAction.ARCHIVE, true],
    [WorkspaceRole.ADMIN, WorkspaceAction.UPDATE, false]
  ];

  for (const [role, action, allowed] of cases) {
    test(`${role} ${action} = ${allowed}`, () => {
      expect(WorkspaceAuthorizationPolicy.canPerform(role, action)).toBe(allowed);
    });
  }
});

describe('token and email content', () => {
  test('token kriptografis tidak sama dengan hash dan URL memakai fragment', async () => {
    const generator = new CryptoInvitationTokenGenerator();
    const generated = await generator.generate();
    expect(generated.token.length).toBeGreaterThanOrEqual(43);
    expect(generated.tokenHash).toHaveLength(64);
    expect(generated.tokenHash).not.toBe(generated.token);
    expect(await generator.hash(generated.token)).toBe(generated.tokenHash);
    const url = buildInvitationUrl('https://app.example.com/', generated.token);
    expect(url.startsWith('https://app.example.com/invitations/accept#token=')).toBe(true);
    expect(url.includes('?')).toBe(false);
    const rendered = renderInvitationEmail({
      recipientEmail: 'friend@example.com',
      inviterName: 'Owner',
      workspaceName: 'Development Team',
      role: 'member',
      invitationUrl: url,
      expiresAt: new Date('2026-11-14T05:00:00.000Z')
    });
    expect(rendered.subject).toBe('You have been invited to a Todo Workspace');
    expect(rendered.text).toContain('Development Team');
    expect(rendered.text).toContain('Owner');
    expect(rendered.html).toContain('member');
    expect(rendered.text).toContain('2026-11-14T05:00:00.000Z');
    expect(rendered.text).toContain('#token=');
  });
});
