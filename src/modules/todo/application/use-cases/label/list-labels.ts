import type { LabelRepository } from '../../../domain/repositories/label.repository';
import { toLabelDto, type LabelListResponseDto } from '../../dto/label.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoCursorCodec } from '../../ports/todo-cursor-codec';
import {
  normalizeMetadataLimit,
  normalizeMetadataSearch
} from '../../services/metadata-pagination';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface ListLabelsInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
  readonly q?: string | undefined;
}

export class ListLabels {
  constructor(
    private readonly labels: LabelRepository,
    private readonly access: TodoAccessService,
    private readonly cursorCodec: TodoCursorCodec
  ) {}

  async execute(input: ListLabelsInput): Promise<LabelListResponseDto> {
    const limit = normalizeMetadataLimit(input.limit);
    const search = normalizeMetadataSearch(input.q);

    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const fingerprint = this.cursorCodec.fingerprint({
      kind: 'labels',
      search: search ?? null
    });
    const cursor =
      input.cursor === undefined || input.cursor === null
        ? null
        : this.cursorCodec.decode(input.cursor, {
            workspaceId: input.workspaceId,
            fingerprint
          });

    const result = await this.labels.list({
      workspaceId: input.workspaceId,
      ...(search !== undefined ? { search } : {}),
      cursor,
      limit
    });

    const lastItem = result.items[result.items.length - 1];
    const hasMore = result.hasMore && lastItem !== undefined;
    const nextCursor =
      hasMore && lastItem
        ? this.cursorCodec.encode({
            workspaceId: input.workspaceId,
            createdAt: lastItem.createdAt,
            id: lastItem.id,
            fingerprint
          })
        : null;

    return {
      items: result.items.map(toLabelDto),
      pagination: { limit, hasMore, nextCursor }
    };
  }
}
