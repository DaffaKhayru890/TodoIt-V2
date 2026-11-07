import { describe, expect, test } from 'bun:test';
import { CreateWorkspace } from '../../../src/modules/workspace/application/use-cases/create-workspace';
import { InMemoryWorkspaceRepository } from '../../helpers/in-memory-workspace-repository';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { WorkspaceRole } from '../../../src/modules/workspace/domain/enums/workspace-role';

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('CreateWorkspace use case', () => {
  test('data valid berhasil membuat workspace dan creator menjadi OWNER', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const useCase = new CreateWorkspace(repo, fixedClock);

    const result = await useCase.execute({
      userId: 'user-1',
      name: 'Personal Workspace',
      description: 'My tasks'
    });

    expect(result.id).toBeString();
    expect(result.name).toBe('Personal Workspace');
    expect(result.description).toBe('My tasks');
    expect(result.role).toBe(WorkspaceRole.OWNER);
    expect(result.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(result.archivedAt).toBeNull();

    // Verifikasi di repository
    expect(repo.workspaces.length).toBe(1);
    expect(repo.members.length).toBe(1);
    expect(repo.members[0]?.userId).toBe('user-1');
    expect(repo.members[0]?.role).toBe(WorkspaceRole.OWNER);
  });

  test('name kosong atau hanya spasi ditolak', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const useCase = new CreateWorkspace(repo, fixedClock);

    await expect(
      useCase.execute({
        userId: 'user-1',
        name: '   ',
        description: null
      })
    ).rejects.toThrow('Nama workspace wajib diisi (1-100 karakter).');
  });

  test('name lebih dari 100 karakter ditolak', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const useCase = new CreateWorkspace(repo, fixedClock);

    await expect(
      useCase.execute({
        userId: 'user-1',
        name: 'a'.repeat(101),
        description: null
      })
    ).rejects.toThrow('Nama workspace wajib diisi (1-100 karakter).');
  });

  test('description lebih dari 500 karakter ditolak', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const useCase = new CreateWorkspace(repo, fixedClock);

    await expect(
      useCase.execute({
        userId: 'user-1',
        name: 'Workspace',
        description: 'd'.repeat(501)
      })
    ).rejects.toThrow('Deskripsi workspace maksimal 500 karakter.');
  });

  test('gagal insert membership menyebabkan rollback (atomik)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    repo.failOnMembershipInsert = true;
    const useCase = new CreateWorkspace(repo, fixedClock);

    await expect(
      useCase.execute({
        userId: 'user-1',
        name: 'Workspace',
        description: null
      })
    ).rejects.toThrow('Database transaction failed while inserting member');

    // Karena rollback, workspace tidak boleh tersisa
    expect(repo.workspaces.length).toBe(0);
    expect(repo.members.length).toBe(0);
  });
});
