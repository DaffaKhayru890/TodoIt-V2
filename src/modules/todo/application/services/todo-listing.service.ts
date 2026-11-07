import { TodoError } from '../../domain/errors/todo-error';
import type {
  TodoCursorPosition,
  TodoQueryCriteria,
  TodoRepository
} from '../../domain/repositories/todo.repository';
import { toTodoDto, type TodoListResponseDto } from '../dto/todo.dto';
import { TodoAction } from '../policies/todo-access.policy';
import type {
  FingerprintValue,
  TodoCursorCodec,
  TodoFilterFingerprintInput
} from '../ports/todo-cursor-codec';
import type { TodoAccessService } from './todo-access.service';
import type { TodoMetadataService } from './todo-metadata.service';

export const DEFAULT_TODO_LIST_LIMIT = 20;
export const MAX_TODO_LIST_LIMIT = 100;

export type TodoListingKind = 'list' | 'today' | 'upcoming' | 'overdue';

/**
 * Deskripsi listing yang menentukan fingerprint cursor. Dua request dengan
 * filter/view berbeda tidak boleh saling memakai cursor.
 */
export interface TodoListingDescriptor {
  readonly kind: TodoListingKind;
  readonly criteria: TodoQueryCriteria;
  readonly timezone?: string;
  readonly includeCompleted?: boolean;
  readonly days?: number;
}

export interface TodoListingInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
  readonly descriptor: TodoListingDescriptor;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_TODO_LIST_LIMIT;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TODO_LIST_LIMIT) {
    throw TodoError.validationError(
      `Limit harus bilangan bulat antara 1 dan ${MAX_TODO_LIST_LIMIT}.`
    );
  }

  return limit;
}

function isoOrNull(value: Date | undefined): string | null {
  return value === undefined ? null : value.toISOString();
}

function buildFingerprintInput(descriptor: TodoListingDescriptor): TodoFilterFingerprintInput {
  const { criteria } = descriptor;

  return {
    kind: descriptor.kind,
    status: criteria.status ?? null,
    priority: criteria.priority ?? null,
    dueAtFrom: isoOrNull(criteria.dueAtFrom),
    dueAtTo: isoOrNull(criteria.dueAtTo),
    dueAtBefore: isoOrNull(criteria.dueAtBefore),
    createdFrom: isoOrNull(criteria.createdFrom),
    createdTo: isoOrNull(criteria.createdTo),
    search: criteria.search ?? null,
    excludedStatuses: [...(criteria.excludedStatuses ?? [])].sort(),
    // tagIds dinormalisasi dengan sorting agar urutan query tidak mengubah hash.
    tagIds: [...(criteria.tagIds ?? [])].sort(),
    labelId: criteria.labelId ?? null,
    timezone: descriptor.timezone ?? null,
    includeCompleted: descriptor.includeCompleted ?? null,
    days: descriptor.days ?? null
  } satisfies Record<string, FingerprintValue>;
}

/**
 * Orchestrator listing yang dipakai List, Today, Upcoming, dan Overdue.
 * Menjaga agar validasi limit, fingerprint, cursor, dan bentuk respons
 * konsisten di semua endpoint.
 */
export class TodoListingService {
  constructor(
    private readonly todos: TodoRepository,
    private readonly access: TodoAccessService,
    private readonly cursorCodec: TodoCursorCodec,
    private readonly metadata: TodoMetadataService
  ) {}

  async execute(input: TodoListingInput): Promise<TodoListResponseDto> {
    const limit = normalizeLimit(input.limit);

    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const fingerprint = this.cursorCodec.fingerprint(buildFingerprintInput(input.descriptor));
    const cursor: TodoCursorPosition | null =
      input.cursor === undefined || input.cursor === null
        ? null
        : this.cursorCodec.decode(input.cursor, {
            workspaceId: input.workspaceId,
            fingerprint
          });

    const result = await this.todos.list({
      workspaceId: input.workspaceId,
      criteria: input.descriptor.criteria,
      cursor,
      limit
    });

    const relations = await this.metadata.load(input.workspaceId, result.items);

    const lastItem = result.items[result.items.length - 1];
    const hasMore = result.hasMore && lastItem !== undefined;
    const nextCursor = hasMore && lastItem
      ? this.cursorCodec.encode({
          workspaceId: input.workspaceId,
          createdAt: lastItem.createdAt,
          id: lastItem.id,
          fingerprint
        })
      : null;

    return {
      items: result.items.map((todo) => toTodoDto(todo, relations.get(todo.id))),
      pagination: {
        limit,
        hasMore,
        nextCursor
      }
    };
  }
}
