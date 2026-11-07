import { TodoStatus } from '../../domain/enums/todo-status';
import type { TodoListResponseDto } from '../dto/todo.dto';
import { normalizeLabelFilter, normalizeTagFilter } from '../services/metadata-filter';
import type { TodoDateRangeService } from '../services/todo-date-range.service';
import type { TodoListingService } from '../services/todo-listing.service';

export interface ListTodayTodosInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly timezone?: string | undefined;
  readonly includeCompleted?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export class ListTodayTodos {
  constructor(
    private readonly listing: TodoListingService,
    private readonly dates: TodoDateRangeService
  ) {}

  async execute(input: ListTodayTodosInput): Promise<TodoListResponseDto> {
    const includeCompleted = input.includeCompleted ?? false;
    const range = this.dates.today(input.timezone);
    const tagIds = normalizeTagFilter(input.tagIds);
    const labelId = normalizeLabelFilter(input.labelId);

    const excludedStatuses = includeCompleted
      ? [TodoStatus.CANCELLED]
      : [TodoStatus.COMPLETED, TodoStatus.CANCELLED];

    return await this.listing.execute({
      workspaceId: input.workspaceId,
      userId: input.userId,
      limit: input.limit,
      cursor: input.cursor,
      descriptor: {
        kind: 'today',
        criteria: {
          dueAtFrom: range.start,
          dueAtBefore: range.end,
          excludedStatuses,
          ...(tagIds !== undefined ? { tagIds } : {}),
          ...(labelId !== undefined ? { labelId } : {})
        },
        timezone: range.timezone,
        includeCompleted
      }
    });
  }
}
