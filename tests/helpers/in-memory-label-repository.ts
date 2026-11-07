import type { Label } from '../../src/modules/todo/domain/entities/label';
import { TodoError } from '../../src/modules/todo/domain/errors/todo-error';
import type {
  LabelListQuery,
  LabelListResult,
  LabelRepository
} from '../../src/modules/todo/domain/repositories/label.repository';
import type { InMemoryTodoRepository } from './in-memory-todo-repository';

/**
 * In-memory Label repository. Delete meniru ON DELETE SET NULL: seluruh Todo
 * yang memakai label tersebut kehilangan labelId tanpa ikut terhapus.
 */
export class InMemoryLabelRepository implements LabelRepository {
  readonly labels: Label[] = [];

  constructor(private readonly todoRepo: InMemoryTodoRepository) {}

  async create(label: Label): Promise<Label> {
    const duplicate = this.labels.some(
      (candidate) =>
        candidate.workspaceId === label.workspaceId &&
        candidate.normalizedName === label.normalizedName
    );

    if (duplicate) {
      throw TodoError.labelAlreadyExists();
    }

    this.labels.push(label);
    return label;
  }

  async findById(workspaceId: string, labelId: string): Promise<Label | null> {
    return (
      this.labels.find(
        (label) => label.workspaceId === workspaceId && label.id === labelId
      ) ?? null
    );
  }

  async findByIds(
    workspaceId: string,
    labelIds: readonly string[]
  ): Promise<readonly Label[]> {
    const wanted = new Set(labelIds);

    return this.labels
      .filter((label) => label.workspaceId === workspaceId && wanted.has(label.id))
      .sort((left, right) =>
        left.name === right.name
          ? left.id.localeCompare(right.id)
          : left.name.localeCompare(right.name)
      );
  }

  async findByName(workspaceId: string, normalizedName: string): Promise<Label | null> {
    return (
      this.labels.find(
        (label) =>
          label.workspaceId === workspaceId && label.normalizedName === normalizedName
      ) ?? null
    );
  }

  async update(label: Label): Promise<Label | null> {
    const index = this.labels.findIndex(
      (candidate) =>
        candidate.workspaceId === label.workspaceId && candidate.id === label.id
    );

    if (index < 0) {
      return null;
    }

    const duplicate = this.labels.some(
      (candidate) =>
        candidate.workspaceId === label.workspaceId &&
        candidate.id !== label.id &&
        candidate.normalizedName === label.normalizedName
    );

    if (duplicate) {
      throw TodoError.labelAlreadyExists();
    }

    this.labels[index] = label;
    return label;
  }

  async delete(workspaceId: string, labelId: string): Promise<boolean> {
    const index = this.labels.findIndex(
      (label) => label.workspaceId === workspaceId && label.id === labelId
    );

    if (index < 0) {
      return false;
    }

    this.labels.splice(index, 1);

    // ON DELETE SET NULL: labelId dikosongkan tanpa mengubah updatedAt Todo.
    for (let todoIndex = 0; todoIndex < this.todoRepo.todos.length; todoIndex += 1) {
      const todo = this.todoRepo.todos[todoIndex];

      if (!todo || todo.labelId !== labelId) {
        continue;
      }

      this.todoRepo.todos[todoIndex] = todo.update(
        { labelId: null },
        todo.updatedAt
      );
    }

    return true;
  }

  async list(query: LabelListQuery): Promise<LabelListResult> {
    const needle = query.search?.toLowerCase();

    const filtered = this.labels.filter((label) => {
      if (label.workspaceId !== query.workspaceId) {
        return false;
      }

      if (needle !== undefined && !label.name.toLowerCase().includes(needle)) {
        return false;
      }

      if (query.cursor !== null) {
        const createdAt = label.createdAt.getTime();
        const cursorCreatedAt = query.cursor.createdAt.getTime();

        if (createdAt > cursorCreatedAt) {
          return false;
        }

        if (createdAt === cursorCreatedAt && label.id >= query.cursor.id) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((left, right) => {
      const difference = right.createdAt.getTime() - left.createdAt.getTime();

      if (difference !== 0) {
        return difference;
      }

      return left.id < right.id ? 1 : left.id > right.id ? -1 : 0;
    });

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;

    return { items, hasMore };
  }
}
