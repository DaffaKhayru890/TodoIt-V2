import type { TagDto } from '@/features/tags/models/tag.dto';

export function makeTagDto(overrides: Partial<TagDto> = {}): TagDto {
  return {
    id: 'a1111111-1111-4111-8111-111111111111',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    name: 'backend',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides
  };
}

export const tagFixtures: readonly TagDto[] = [
  makeTagDto(),
  makeTagDto({
    id: 'a2222222-2222-4222-8222-222222222222',
    name: 'design'
  })
];
