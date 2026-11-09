import type { LabelDto } from '@/features/labels/models/label.dto';

export function makeLabelDto(overrides: Partial<LabelDto> = {}): LabelDto {
  return {
    id: 'b1111111-1111-4111-8111-111111111111',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    name: 'Bug',
    color: '#E74C3C',
    description: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides
  };
}

export const labelFixtures: readonly LabelDto[] = [
  makeLabelDto(),
  makeLabelDto({
    id: 'b2222222-2222-4222-8222-222222222222',
    name: 'Feature',
    color: '#27AE60',
    description: 'Pekerjaan fitur baru'
  })
];
