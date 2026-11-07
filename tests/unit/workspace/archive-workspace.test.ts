import { describe, expect, test } from 'bun:test';
import { ArchiveWorkspace } from '../../../src/modules/workspace/application/use-cases/archive-workspace';
import { CreateWorkspace } from '../../../src/modules/workspace/application/use-cases/create-workspace';
import { InMemoryWorkspaceRepository } from '../../helpers/in-memory-workspace-repository';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { WorkspaceRole } from '../../../src/modules/workspace/domain/enums/workspace-role';
import { WorkspaceError } from '../../../src/modules/workspace/domain/errors/workspace-error';

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('ArchiveWorkspace use case', () => {
  test('owner berhasil mengarsipkan workspace', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Project to Archive'
    });

    const archive = new ArchiveWorkspace(repo, fixedClock);

    const result = await archive.execute({
      workspaceId: created.id,
      userId: 'user-owner'
    });

    expect(result.workspace.id).toBe(created.id);
    expect(result.workspace.archivedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  test('pengarsipan bersifat idempoten', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Project to Archive'
    });

    const archive = new ArchiveWorkspace(repo, fixedClock);

    const result1 = await archive.execute({
      workspaceId: created.id,
      userId: 'user-owner'
    });

    const result2 = await archive.execute({
      workspaceId: created.id,
      userId: 'user-owner'
    });

    expect(result1.workspace.archivedAt).toEqual(result2.workspace.archivedAt);
  });

  test('non-owner (member) tidak boleh mengarsipkan (403 WORKSPACE_PERMISSION_DENIED)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Project'
    });

    repo.members.push({
      id: crypto.randomUUID(),
      workspaceId: created.id,
      userId: 'user-member',
      role: WorkspaceRole.MEMBER,
      joinedAt: new Date()
    });

    const archive = new ArchiveWorkspace(repo, fixedClock);

    let error: any;
    try {
      await archive.execute({
        workspaceId: created.id,
        userId: 'user-member'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkspaceError);
    expect(error.code).toBe('WORKSPACE_PERMISSION_DENIED');
  });

  test('user asing tidak boleh mengarsipkan (404 WORKSPACE_ACCESS_DENIED)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Project'
    });

    const archive = new ArchiveWorkspace(repo, fixedClock);

    let error: any;
    try {
      await archive.execute({
        workspaceId: created.id,
        userId: 'user-stranger'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkspaceError);
    expect(error.code).toBe('WORKSPACE_ACCESS_DENIED');
  });

  test('workspace tidak ditemukan melempar WORKSPACE_ACCESS_DENIED (404)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const archive = new ArchiveWorkspace(repo, fixedClock);

    await expect(
      archive.execute({
        workspaceId: crypto.randomUUID(),
        userId: 'user-owner'
      })
    ).rejects.toThrow('Workspace tidak ditemukan.');
  });
});
