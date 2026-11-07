import { Tag } from '../../domain/entities/tag';
import type { tags } from '../persistence/tag.schema';

export type TagRow = typeof tags.$inferSelect;

export function toTagEntity(row: TagRow): Tag {
  return Tag.restore({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    normalizedName: row.normalizedName,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}
