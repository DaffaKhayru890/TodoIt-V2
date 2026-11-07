import { describe, expect, test } from 'bun:test';
import { ListWorkspaces } from '../../../src/modules/workspace/application/use-cases/list-workspaces';
import { CreateWorkspace } from '../../../src/modules/workspace/application/use-cases/create-workspace';
import { InMemoryWorkspaceRepository } from '../../helpers/in-memory-workspace-repository';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('ListWorkspaces use case', () => {
  test('mengembalikan workspace milik user dan tidak menampilkan workspace user lain', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    await create.execute({ userId: 'user-1', name: 'User 1 WS 1' });
    await create.execute({ userId: 'user-1', name: 'User 1 WS 2' });
    await create.execute({ userId: 'user-2', name: 'User 2 WS' });

    const list = new ListWorkspaces(repo);

    const result = await list.execute({ userId: 'user-1' });

    expect(result.items.length).toBe(2);
    expect(result.pagination.total).toBe(2);
    expect(result.items.every((item) => item.name.includes('User 1'))).toBe(true);
  });

  test('tidak menampilkan workspace yang sudah diarsipkan', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    const ws1 = await create.execute({ userId: 'user-1', name: 'Active WS' });
    const ws2 = await create.execute({ userId: 'user-1', name: 'Archived WS' });

    // Arsipkan ws2
    await repo.archiveWorkspace({ id: ws2.id, now: new Date() });

    const list = new ListWorkspaces(repo);
    const result = await list.execute({ userId: 'user-1' });

    expect(result.items.length).toBe(1);
    expect(result.items[0]?.id).toBe(ws1.id);
  });

  test('paginasi default (limit 20, offset 0)', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const list = new ListWorkspaces(repo);

    const result = await list.execute({ userId: 'user-empty' });

    expect(result.items.length).toBe(0);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.total).toBe(0);
  });

  test('membatasi limit maksimal ke 50', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const list = new ListWorkspaces(repo);

    const result = await list.execute({ userId: 'user-1', limit: 100 });

    expect(result.pagination.limit).toBe(50);
  });

  test('offset pagination bekerja sesuai input', async () => {
    const repo = new InMemoryWorkspaceRepository();
    const create = new CreateWorkspace(repo, fixedClock);

    for (let i = 1; i <= 5; i++) {
      await create.execute({ userId: 'user-1', name: `WS ${i}` });
    }

    const list = new ListWorkspaces(repo);
    const page1 = await list.execute({ userId: 'user-1', limit: 2, offset: 0 });
    const page2 = await list.execute({ userId: 'user-1', limit: 2, offset: 2 });

    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(2);
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
    expect(page1.pagination.total).toBe(5);
  });
});
