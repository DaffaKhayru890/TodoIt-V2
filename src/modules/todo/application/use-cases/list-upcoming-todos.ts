import { TodoStatus } from '../../domain/enums/todo-status';
import type { TodoListResponseDto } from '../dto/todo.dto';
import { normalizeLabelFilter, normalizeTagFilter } from '../services/metadata-filter';
import {
  DEFAULT_UPCOMING_DAYS,
  type TodoDateRangeService
} from '../services/todo-date-range.service';
import type { TodoListingService } from '../services/todo-listing.service';

export interface ListUpcomingTodosInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly timezone?: string | undefined;
  readonly days?: number | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export class ListUpcomingTodos {
  constructor(
    private readonly listing: TodoListingService,
    private readonly dates: TodoDateRangeService
  ) {}

  async execute(input: ListUpcomingTodosInput): Promise<TodoListResponseDto> {
    const days = input.days ?? DEFAULT_UPCOMING_DAYS;
    const range = this.dates.upcoming(input.timezone, days);
    const tagIds = normalizeTagFilter(input.tagIds);
    const labelId = normalizeLabelFilter(input.labelId);

    return await this.listing.execute({
      workspaceId: input.workspaceId,
      userId: input.userId,
      limit: input.limit,
      cursor: input.cursor,
      descriptor: {
        kind: 'upcoming',
        criteria: {
          dueAtFrom: range.start,
          dueAtBefore: range.end,
          excludedStatuses: [TodoStatus.COMPLETED, TodoStatus.CANCELLED],
          ...(tagIds !== undefined ? { tagIds } : {}),
          ...(labelId !== undefined ? { labelId } : {})
        },
        timezone: range.timezone,
        days
      }
    });
  }
}
