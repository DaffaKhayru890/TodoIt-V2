import { describe, expect, test } from 'bun:test';
import { GetWorkspace } from '../../../src/modules/workspace/application/use-cases/get-workspace';
import { CreateWorkspace } from '../../../src/modules/workspace/application/use-cases/create-workspace';
import { InMemoryWorkspaceRepository } from '../../helpers/in-memory-workspace-repository';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { WorkspaceError } from '../../../src/modules/workspace/domain/errors/workspace-error';

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('GetWorkspace use case', () => {
  test('mengembalikan detail workspace jika user adalah member', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-1',
      name: 'Project Alpha',
      description: 'Alpha tasks'
    });

    const get = new GetWorkspace(repo);
    const result = await get.execute({
      workspaceId: created.id,
      userId: 'user-1'
    });

    expect(result.id).toBe(created.id);
    expect(result.name).toBe('Project Alpha');
    expect(result.description).toBe('Alpha tasks');
    expect(result.role).toBe('owner');
  });

  test('user bukan member melempar WORKSPACE_ACCESS_DENIED (404 anti-enumeration)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-1',
      name: 'Project Alpha'
    });

    const get = new GetWorkspace(repo);

    let error: any;
    try {
      await get.execute({
        workspaceId: created.id,
        userId: 'user-stranger'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkspaceError);
    expect(error.code).toBe('WORKSPACE_ACCESS_DENIED');
  });

  test('workspace tidak ada melempar WORKSPACE_ACCESS_DENIED', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const get = new GetWorkspace(repo);

    await expect(
      get.execute({
        workspaceId: crypto.randomUUID(),
        userId: 'user-1'
      })
    ).rejects.toThrow('Workspace tidak ditemukan.');
  });

  test('workspace yang diarsipkan melempar WORKSPACE_ACCESS_DENIED', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-1',
      name: 'Archived Project'
    });

    await repo.archiveWorkspace({ id: created.id, now: new Date() });

    const get = new GetWorkspace(repo);

    await expect(
      get.execute({
        workspaceId: created.id,
        userId: 'user-1'
      })
    ).rejects.toThrow('Workspace tidak ditemukan.');
  });
});
