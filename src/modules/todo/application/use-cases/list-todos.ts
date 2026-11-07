import { isTodoPriority, type TodoPriority } from '../../domain/enums/todo-priority';
import { isTodoStatus, type TodoStatus } from '../../domain/enums/todo-status';
import { TodoError } from '../../domain/errors/todo-error';
import type { TodoQueryCriteria } from '../../domain/repositories/todo.repository';
import type { TodoListResponseDto } from '../dto/todo.dto';
import { assertChronologicalRange } from '../services/instant-parser';
import { normalizeLabelFilter, normalizeTagFilter } from '../services/metadata-filter';
import type { TodoListingService } from '../services/todo-listing.service';

export const MAX_SEARCH_LENGTH = 200;

export interface ListTodosInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
  readonly status?: string | undefined;
  readonly priority?: string | undefined;
  readonly dueFrom?: Date | undefined;
  readonly dueTo?: Date | undefined;
  readonly createdFrom?: Date | undefined;
  readonly createdTo?: Date | undefined;
  readonly q?: string | undefined;
  /** Boleh berupa satu nilai atau daftar; semantics ANY. */
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export class ListTodos {
  constructor(private readonly listing: TodoListingService) {}

  async execute(input: ListTodosInput): Promise<TodoListResponseDto> {
    let status: TodoStatus | undefined;

    if (input.status !== undefined) {
      if (!isTodoStatus(input.status)) {
        throw TodoError.invalidStatus();
      }

      status = input.status;
    }

    let priority: TodoPriority | undefined;

    if (input.priority !== undefined) {
      if (!isTodoPriority(input.priority)) {
        throw TodoError.invalidPriority();
      }

      priority = input.priority;
    }

    assertChronologicalRange(input.dueFrom, input.dueTo, 'dueFrom');
    assertChronologicalRange(input.createdFrom, input.createdTo, 'createdFrom');

    const search = this.normalizeSearch(input.q);
    const tagIds = normalizeTagFilter(input.tagIds);
    const labelId = normalizeLabelFilter(input.labelId);

    const criteria: TodoQueryCriteria = {
      ...(status !== undefined ? { status } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(input.dueFrom !== undefined ? { dueAtFrom: input.dueFrom } : {}),
      ...(input.dueTo !== undefined ? { dueAtTo: input.dueTo } : {}),
      ...(input.createdFrom !== undefined ? { createdFrom: input.createdFrom } : {}),
      ...(input.createdTo !== undefined ? { createdTo: input.createdTo } : {}),
      ...(search !== undefined ? { search } : {}),
      ...(tagIds !== undefined ? { tagIds } : {}),
      ...(labelId !== undefined ? { labelId } : {})
    };

    return await this.listing.execute({
      workspaceId: input.workspaceId,
      userId: input.userId,
      limit: input.limit,
      cursor: input.cursor,
      descriptor: { kind: 'list', criteria }
    });
  }

  private normalizeSearch(q: string | undefined): string | undefined {
    if (q === undefined) {
      return undefined;
    }

    const search = q.trim();

    if (search.length === 0) {
      return undefined;
    }

    if (search.length > MAX_SEARCH_LENGTH) {
      throw TodoError.validationError(`Kata kunci pencarian maksimal ${MAX_SEARCH_LENGTH} karakter.`);
    }

    return search;
  }
}
