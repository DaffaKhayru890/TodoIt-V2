import { describe, expect, test } from 'vitest';
import {
  deriveWorkspaceMark,
  parseWorkspaceRole,
  toArchiveWorkspaceResult,
  toCreateWorkspaceRequestDto,
  toUpdateWorkspaceRequestDto,
  toWorkspace,
  toWorkspaceListItem,
  toWorkspaceListResult
} from './workspace.mapper';

describe('workspace.mapper', () => {
  test('deriveWorkspaceMark mengambil karakter pertama huruf kapital', () => {
    expect(deriveWorkspaceMark('personal')).toBe('P');
    expect(deriveWorkspaceMark('  tim proyek')).toBe('T');
    expect(deriveWorkspaceMark('')).toBe('W');
  });

  test('parseWorkspaceRole mengembalikan role valid atau fallback ke member', () => {
    expect(parseWorkspaceRole('owner')).toBe('owner');
    expect(parseWorkspaceRole('admin')).toBe('admin');
    expect(parseWorkspaceRole('member')).toBe('member');
    expect(parseWorkspaceRole('unknown')).toBe('member');
  });

  test('toWorkspace memetakan DTO menjadi entity domain dengan mark dan Date', () => {
    const dto = {
      id: 'ws-1',
      name: 'Kantor',
      description: 'Ruang kerja bersama',
      role: 'owner',
      createdAt: '2026-11-07T10:00:00.000Z',
      updatedAt: '2026-11-07T12:00:00.000Z',
      archivedAt: null
    };

    const model = toWorkspace(dto);
    expect(model.id).toBe('ws-1');
    expect(model.name).toBe('Kantor');
    expect(model.description).toBe('Ruang kerja bersama');
    expect(model.role).toBe('owner');
    expect(model.mark).toBe('K');
    expect(model.createdAt).toBeInstanceOf(Date);
    expect(model.updatedAt).toBeInstanceOf(Date);
    expect(model.archivedAt).toBeNull();
  });

  test('toWorkspaceListItem memetakan item daftar', () => {
    const dto = {
      id: 'ws-2',
      name: 'Belajar',
      description: null,
      role: 'admin',
      createdAt: '2026-11-07T10:00:00.000Z'
    };

    const item = toWorkspaceListItem(dto);
    expect(item.id).toBe('ws-2');
    expect(item.name).toBe('Belajar');
    expect(item.description).toBeNull();
    expect(item.role).toBe('admin');
    expect(item.mark).toBe('B');
  });

  test('toWorkspaceListResult memetakan respons paginasi', () => {
    const dto = {
      items: [
        {
          id: 'ws-3',
          name: 'Personal',
          description: null,
          role: 'member',
          createdAt: '2026-11-07T10:00:00.000Z'
        }
      ],
      pagination: {
        limit: 20,
        offset: 0,
        total: 1
      }
    };

    const result = toWorkspaceListResult(dto);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe('Personal');
    expect(result.pagination.total).toBe(1);
  });

  test('toCreateWorkspaceRequestDto memformat payload create', () => {
    expect(toCreateWorkspaceRequestDto({ name: '  Baru  ', description: '  Ket  ' })).toEqual({
      name: 'Baru',
      description: 'Ket'
    });
    expect(toCreateWorkspaceRequestDto({ name: 'Baru' })).toEqual({
      name: 'Baru'
    });
  });

  test('toUpdateWorkspaceRequestDto memformat payload update', () => {
    expect(toUpdateWorkspaceRequestDto({ name: 'Update', description: null })).toEqual({
      name: 'Update',
      description: null
    });
    expect(toUpdateWorkspaceRequestDto({ name: 'Update' })).toEqual({
      name: 'Update'
    });
  });

  test('toArchiveWorkspaceResult memetakan hasil archive', () => {
    const result = toArchiveWorkspaceResult({
      workspace: {
        id: 'ws-1',
        archivedAt: '2026-11-07T15:00:00.000Z'
      }
    });

    expect(result.id).toBe('ws-1');
    expect(result.archivedAt).toBeInstanceOf(Date);
  });
});
