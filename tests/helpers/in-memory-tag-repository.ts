import type { Tag } from '../../src/modules/todo/domain/entities/tag';
import { TodoError } from '../../src/modules/todo/domain/errors/todo-error';
import type {
  AddTodoTagCommand,
  ReplaceTodoTagsCommand,
  TagListQuery,
  TagListResult,
  TagRepository
} from '../../src/modules/todo/domain/repositories/tag.repository';
import type { InMemoryTodoRepository } from './in-memory-todo-repository';

/**
 * In-memory Tag repository yang meniru constraint unique (workspace_id,
 * normalized_name) dan cascade association melalui peta bersama di
 * InMemoryTodoRepository.
 */
export class InMemoryTagRepository implements TagRepository {
  readonly tags: Tag[] = [];

  constructor(private readonly todoRepo: InMemoryTodoRepository) {}

  async create(tag: Tag): Promise<Tag> {
    const duplicate = this.tags.some(
      (candidate) =>
        candidate.workspaceId === tag.workspaceId &&
        candidate.normalizedName === tag.normalizedName
    );

    if (duplicate) {
      throw TodoError.tagAlreadyExists();
    }

    this.tags.push(tag);
    return tag;
  }

  async findById(workspaceId: string, tagId: string): Promise<Tag | null> {
    return (
      this.tags.find(
        (tag) => tag.workspaceId === workspaceId && tag.id === tagId
      ) ?? null
    );
  }

  async findByIds(workspaceId: string, tagIds: readonly string[]): Promise<readonly Tag[]> {
    const wanted = new Set(tagIds);

    return this.tags
      .filter((tag) => tag.workspaceId === workspaceId && wanted.has(tag.id))
      .sort((left, right) =>
        left.name === right.name
          ? left.id.localeCompare(right.id)
          : left.name.localeCompare(right.name)
      );
  }

  async findByName(workspaceId: string, normalizedName: string): Promise<Tag | null> {
    return (
      this.tags.find(
        (tag) =>
          tag.workspaceId === workspaceId && tag.normalizedName === normalizedName
      ) ?? null
    );
  }

  async update(tag: Tag): Promise<Tag | null> {
    const index = this.tags.findIndex(
      (candidate) =>
        candidate.workspaceId === tag.workspaceId && candidate.id === tag.id
    );

    if (index < 0) {
      return null;
    }

    const duplicate = this.tags.some(
      (candidate) =>
        candidate.workspaceId === tag.workspaceId &&
        candidate.id !== tag.id &&
        candidate.normalizedName === tag.normalizedName
    );

    if (duplicate) {
      throw TodoError.tagAlreadyExists();
    }

    this.tags[index] = tag;
    return tag;
  }

  async delete(workspaceId: string, tagId: string): Promise<boolean> {
    const index = this.tags.findIndex(
      (tag) => tag.workspaceId === workspaceId && tag.id === tagId
    );

    if (index < 0) {
      return false;
    }

    this.tags.splice(index, 1);

    // ON DELETE CASCADE pada todo_tags.
    for (const assigned of this.todoRepo.todoTagIds.values()) {
      assigned.delete(tagId);
    }

    return true;
  }

  async list(query: TagListQuery): Promise<TagListResult> {
    const needle = query.search?.toLowerCase();

    const filtered = this.tags.filter((tag) => {
      if (tag.workspaceId !== query.workspaceId) {
        return false;
      }

      if (needle !== undefined && !tag.name.toLowerCase().includes(needle)) {
        return false;
      }

      if (query.cursor !== null) {
        const createdAt = tag.createdAt.getTime();
        const cursorCreatedAt = query.cursor.createdAt.getTime();

        if (createdAt > cursorCreatedAt) {
          return false;
        }

        if (createdAt === cursorCreatedAt && tag.id >= query.cursor.id) {
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

  async findByTodoIds(
    todoIds: readonly string[]
  ): Promise<ReadonlyMap<string, readonly Tag[]>> {
    const result = new Map<string, Tag[]>();

    for (const todoId of todoIds) {
      const assigned = this.todoRepo.todoTagIds.get(todoId);

      if (!assigned || assigned.size === 0) {
        continue;
      }

      const tags = this.tags
        .filter((tag) => assigned.has(tag.id))
        .sort((left, right) =>
          left.name === right.name
            ? left.id.localeCompare(right.id)
            : left.name.localeCompare(right.name)
        );

      result.set(todoId, tags);
    }

    return result;
  }

  async findTodoTagIds(todoId: string): Promise<readonly string[]> {
    return [...(this.todoRepo.todoTagIds.get(todoId) ?? new Set<string>())];
  }

  async countTodoTags(todoId: string): Promise<number> {
    return this.todoRepo.todoTagIds.get(todoId)?.size ?? 0;
  }

  async replaceTodoTags(command: ReplaceTodoTagsCommand): Promise<void> {
    this.todoRepo.todoTagIds.set(command.todoId, new Set(command.tagIds));
  }

  async addTodoTag(command: AddTodoTagCommand): Promise<boolean> {
    const assigned = this.todoRepo.todoTagIds.get(command.todoId) ?? new Set<string>();

    if (assigned.has(command.tagId)) {
      return false;
    }

    assigned.add(command.tagId);
    this.todoRepo.todoTagIds.set(command.todoId, assigned);

    return true;
  }

  async removeTodoTag(todoId: string, tagId: string): Promise<boolean> {
    const assigned = this.todoRepo.todoTagIds.get(todoId);

    if (!assigned || !assigned.delete(tagId)) {
      return false;
    }

    return true;
  }
}
