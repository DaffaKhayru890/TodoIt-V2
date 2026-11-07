import { Label } from '../../domain/entities/label';
import type { labels } from '../persistence/label.schema';

export type LabelRow = typeof labels.$inferSelect;

export function toLabelEntity(row: LabelRow): Label {
  return Label.restore({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    normalizedName: row.normalizedName,
    color: row.color,
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}
