import { describe, expect, test } from 'bun:test';
import { UpdateWorkspace } from '../../../src/modules/workspace/application/use-cases/update-workspace';
import { CreateWorkspace } from '../../../src/modules/workspace/application/use-cases/create-workspace';
import { InMemoryWorkspaceRepository } from '../../helpers/in-memory-workspace-repository';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { WorkspaceRole } from '../../../src/modules/workspace/domain/enums/workspace-role';
import { WorkspaceError } from '../../../src/modules/workspace/domain/errors/workspace-error';

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('UpdateWorkspace use case', () => {
  test('owner berhasil memperbarui nama dan deskripsi', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Initial Name',
      description: 'Initial Desc'
    });

    const update = new UpdateWorkspace(repo, fixedClock);

    const result = await update.execute({
      workspaceId: created.id,
      userId: 'user-owner',
      name: 'Updated Name',
      description: 'Updated Desc'
    });

    expect(result.name).toBe('Updated Name');
    expect(result.description).toBe('Updated Desc');
  });

  test('member biasa tidak boleh memperbarui (403 WORKSPACE_PERMISSION_DENIED)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Initial Name'
    });

    // Tambah member biasa
    repo.members.push({
      id: crypto.randomUUID(),
      workspaceId: created.id,
      userId: 'user-member',
      role: WorkspaceRole.MEMBER,
      joinedAt: new Date()
    });

    const update = new UpdateWorkspace(repo, fixedClock);

    let error: any;
    try {
      await update.execute({
        workspaceId: created.id,
        userId: 'user-member',
        name: 'New Name'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkspaceError);
    expect(error.code).toBe('WORKSPACE_PERMISSION_DENIED');
  });

  test('user asing tidak boleh memperbarui (404 WORKSPACE_ACCESS_DENIED)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const created = await create.execute({
      userId: 'user-owner',
      name: 'Initial Name'
    });

    const update = new UpdateWorkspace(repo, fixedClock);

    let error: any;
    try {
      await update.execute({
        workspaceId: created.id,
        userId: 'user-stranger',
        name: 'New Name'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(WorkspaceError);
    expect(error.code).toBe('WORKSPACE_ACCESS_DENIED');
  });

  test('request kosong (tanpa name dan description) ditolak', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const update = new UpdateWorkspace(repo, fixedClock);

    await expect(
      update.execute({
        workspaceId: crypto.randomUUID(),
        userId: 'user-owner'
      })
    ).rejects.toThrow('Minimal satu field (name atau description) harus diubah.');
  });

  test('name tidak valid ditolak', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const update = new UpdateWorkspace(repo, fixedClock);

    await expect(
      update.execute({
        workspaceId: crypto.randomUUID(),
        userId: 'user-owner',
        name: '   '
      })
    ).rejects.toThrow('Nama workspace wajib diisi (1-100 karakter).');
  });

  test('description terlalu panjang ditolak', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const update = new UpdateWorkspace(repo, fixedClock);

    await expect(
      update.execute({
        workspaceId: crypto.randomUUID(),
        userId: 'user-owner',
        description: 'x'.repeat(501)
      })
    ).rejects.toThrow('Deskripsi workspace maksimal 500 karakter.');
  });
});
