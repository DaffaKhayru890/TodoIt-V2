import type { TodoDto } from '@/features/todos/models/todo.dto';

/**
 * Fixture pengujian Todo. Jangan diimpor dari kode produksi.
 * Bentuk mengikuti response backend setelah serialisasi Date ke ISO string.
 */
export function makeTodoDto(overrides: Partial<TodoDto> = {}): TodoDto {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    title: 'Tugas contoh',
    description: 'Deskripsi contoh',
    status: 'todo',
    priority: 'low',
    dueAt: null,
    completedAt: null,
    label: null,
    tags: [],
    createdBy: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    createdAt: '2026-11-07T09:00:00.000Z',
    updatedAt: '2026-11-07T09:00:00.000Z',
    ...overrides
  };
}

export const todoFixtures: readonly TodoDto[] = [
  makeTodoDto({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Menyusun rencana sprint',
    description: 'Tentukan prioritas pekerjaan minggu ini.'
  }),
  makeTodoDto({
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title: 'Meninjau dokumentasi',
    description: null,
    status: 'completed',
    completedAt: '2026-11-07T11:00:00.000Z',
    updatedAt: '2026-11-07T11:00:00.000Z'
  })
];
