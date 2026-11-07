import type { Todo } from '../../domain/entities/todo';
import type { LabelRepository } from '../../domain/repositories/label.repository';
import type { TagRepository } from '../../domain/repositories/tag.repository';
import type { TodoRelationsDto } from '../dto/todo.dto';
import { EMPTY_TODO_RELATIONS } from '../dto/todo.dto';
import { toTagSummaryDto } from '../dto/tag.dto';

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Memuat metadata Todo secara batch.
 *
 * Untuk satu halaman listing hanya ada dua query tambahan: satu untuk Label
 * (berdasarkan kumpulan labelId) dan satu untuk Tag (berdasarkan kumpulan
 * todoId). Tidak ada query per Todo, sehingga N+1 tidak terjadi.
 */
export class TodoMetadataService {
  constructor(
    private readonly labels: LabelRepository,
    private readonly tags: TagRepository
  ) {}

  async load(
    workspaceId: string,
    todos: readonly Todo[]
  ): Promise<ReadonlyMap<string, TodoRelationsDto>> {
    const result = new Map<string, TodoRelationsDto>();

    if (todos.length === 0) {
      return result;
    }

    const labelIds = unique(
      todos
        .map((todo) => todo.labelId)
        .filter((labelId): labelId is string => labelId !== null)
    );
    const todoIds = todos.map((todo) => todo.id);

    const [labels, tagsByTodo] = await Promise.all([
      labelIds.length > 0 ? this.labels.findByIds(workspaceId, labelIds) : Promise.resolve([]),
      this.tags.findByTodoIds(todoIds)
    ]);

    const labelsById = new Map(labels.map((label) => [label.id, label]));

    for (const todo of todos) {
      const label = todo.labelId ? labelsById.get(todo.labelId) ?? null : null;
      const tags = tagsByTodo.get(todo.id) ?? [];

      result.set(todo.id, {
        label: label
          ? { id: label.id, name: label.name, color: label.color }
          : null,
        tags: tags.map(toTagSummaryDto)
      });
    }

    return result;
  }

  async loadOne(
    workspaceId: string,
    todo: Todo
  ): Promise<TodoRelationsDto> {
    const relations = await this.load(workspaceId, [todo]);

    return relations.get(todo.id) ?? EMPTY_TODO_RELATIONS;
  }
}
