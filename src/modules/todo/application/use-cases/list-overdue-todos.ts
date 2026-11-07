import { TodoStatus } from '../../domain/enums/todo-status';
import type { TodoListResponseDto } from '../dto/todo.dto';
import { normalizeLabelFilter, normalizeTagFilter } from '../services/metadata-filter';
import type { TodoDateRangeService } from '../services/todo-date-range.service';
import type { TodoListingService } from '../services/todo-listing.service';

export interface ListOverdueTodosInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly timezone?: string | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export class ListOverdueTodos {
  constructor(
    private readonly listing: TodoListingService,
    private readonly dates: TodoDateRangeService
  ) {}

  async execute(input: ListOverdueTodosInput): Promise<TodoListResponseDto> {
    const range = this.dates.overdue(input.timezone);
    const tagIds = normalizeTagFilter(input.tagIds);
    const labelId = normalizeLabelFilter(input.labelId);

    return await this.listing.execute({
      workspaceId: input.workspaceId,
      userId: input.userId,
      limit: input.limit,
      cursor: input.cursor,
      descriptor: {
        kind: 'overdue',
        criteria: {
          dueAtBefore: range.start,
          excludedStatuses: [TodoStatus.COMPLETED, TodoStatus.CANCELLED],
          ...(tagIds !== undefined ? { tagIds } : {}),
          ...(labelId !== undefined ? { labelId } : {})
        },
        timezone: range.timezone
      }
    });
  }
}
