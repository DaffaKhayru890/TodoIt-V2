import { describe, expect, test } from 'vitest';
import { createWorkspaceSchema } from './create-workspace.schema';
import { updateWorkspaceSchema } from './update-workspace.schema';

describe('Workspace schemas', () => {
  describe('createWorkspaceSchema', () => {
    test('menerima nama valid dan deskripsi opsional', () => {
      const valid = createWorkspaceSchema.safeParse({
        name: 'Proyek Utama',
        description: 'Deskripsi singkat'
      });
      expect(valid.success).toBe(true);
    });

    test('menolak nama kosong', () => {
      const invalid = createWorkspaceSchema.safeParse({
        name: '   '
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Nama workspace wajib diisi');
      }
    });

    test('menolak nama melebihi 100 karakter', () => {
      const invalid = createWorkspaceSchema.safeParse({
        name: 'a'.repeat(101)
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Nama workspace maksimal 100 karakter');
      }
    });

    test('menolak deskripsi melebihi 500 karakter', () => {
      const invalid = createWorkspaceSchema.safeParse({
        name: 'Valid Name',
        description: 'd'.repeat(501)
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Deskripsi maksimal 500 karakter');
      }
    });
  });

  describe('updateWorkspaceSchema', () => {
    test('menerima nama valid', () => {
      const valid = updateWorkspaceSchema.safeParse({
        name: 'Nama Baru'
      });
      expect(valid.success).toBe(true);
    });

    test('menolak nama kosong saat update', () => {
      const invalid = updateWorkspaceSchema.safeParse({
        name: '   '
      });
      expect(invalid.success).toBe(false);
    });
  });
});
