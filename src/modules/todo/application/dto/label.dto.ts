import type { Label } from '../../domain/entities/label';

export interface LabelDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly color: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LabelListResponseDto {
  items: LabelDto[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export function toLabelDto(label: Label): LabelDto {
  return {
    id: label.id,
    workspaceId: label.workspaceId,
    name: label.name,
    color: label.color,
    description: label.description,
    createdAt: label.createdAt,
    updatedAt: label.updatedAt
  };
}
