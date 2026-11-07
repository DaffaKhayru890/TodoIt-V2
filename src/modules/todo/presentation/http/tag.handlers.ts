import type { CreateTag } from '../../application/use-cases/tag/create-tag';
import type { ListTags } from '../../application/use-cases/tag/list-tags';
import type { GetTag } from '../../application/use-cases/tag/get-tag';
import type { UpdateTag } from '../../application/use-cases/tag/update-tag';
import type { DeleteTag } from '../../application/use-cases/tag/delete-tag';
import type { ReplaceTodoTags } from '../../application/use-cases/tag/replace-todo-tags';
import type { AddTodoTag } from '../../application/use-cases/tag/add-todo-tag';
import type { RemoveTodoTag } from '../../application/use-cases/tag/remove-todo-tag';
import type { TagDto, TagListResponseDto, TagSummaryDto } from '../../application/dto/tag.dto';

export interface CreateTagBody {
  readonly name: string;
}

export interface UpdateTagBody {
  readonly name?: string | undefined;
}

export interface ListTagsQuery {
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly q?: string | undefined;
}

export interface ReplaceTodoTagsBody {
  readonly tagIds: readonly string[];
}

export interface TagHandlers {
  create(userId: string, workspaceId: string, body: CreateTagBody): Promise<{ tag: TagDto }>;
  list(userId: string, workspaceId: string, query: ListTagsQuery): Promise<TagListResponseDto>;
  get(userId: string, workspaceId: string, tagId: string): Promise<{ tag: TagDto }>;
  update(
    userId: string,
    workspaceId: string,
    tagId: string,
    body: UpdateTagBody
  ): Promise<{ tag: TagDto }>;
  remove(userId: string, workspaceId: string, tagId: string): Promise<void>;
  replaceTodoTags(
    userId: string,
    workspaceId: string,
    todoId: string,
    body: ReplaceTodoTagsBody
  ): Promise<{ tags: TagSummaryDto[] }>;
  addTodoTag(
    userId: string,
    workspaceId: string,
    todoId: string,
    tagId: string
  ): Promise<{ tags: TagSummaryDto[] }>;
  removeTodoTag(
    userId: string,
    workspaceId: string,
    todoId: string,
    tagId: string
  ): Promise<{ tags: TagSummaryDto[] }>;
}

export function createTagHandlers(deps: {
  readonly createTag: CreateTag;
  readonly listTags: ListTags;
  readonly getTag: GetTag;
  readonly updateTag: UpdateTag;
  readonly deleteTag: DeleteTag;
  readonly replaceTodoTags: ReplaceTodoTags;
  readonly addTodoTag: AddTodoTag;
  readonly removeTodoTag: RemoveTodoTag;
}): TagHandlers {
  return {
    async create(userId, workspaceId, body) {
      const tag = await deps.createTag.execute({ workspaceId, userId, name: body.name });

      return { tag };
    },

    async list(userId, workspaceId, query) {
      return await deps.listTags.execute({
        workspaceId,
        userId,
        limit: query.limit,
        cursor: query.cursor,
        q: query.q
      });
    },

    async get(userId, workspaceId, tagId) {
      const tag = await deps.getTag.execute({ workspaceId, userId, tagId });

      return { tag };
    },

    async update(userId, workspaceId, tagId, body) {
      const tag = await deps.updateTag.execute({
        workspaceId,
        userId,
        tagId,
        name: body.name
      });

      return { tag };
    },

    async remove(userId, workspaceId, tagId) {
      await deps.deleteTag.execute({ workspaceId, userId, tagId });
    },

    async replaceTodoTags(userId, workspaceId, todoId, body) {
      return await deps.replaceTodoTags.execute({
        workspaceId,
        userId,
        todoId,
        tagIds: body.tagIds
      });
    },

    async addTodoTag(userId, workspaceId, todoId, tagId) {
      return await deps.addTodoTag.execute({ workspaceId, userId, todoId, tagId });
    },

    async removeTodoTag(userId, workspaceId, todoId, tagId) {
      return await deps.removeTodoTag.execute({ workspaceId, userId, todoId, tagId });
    }
  };
}
