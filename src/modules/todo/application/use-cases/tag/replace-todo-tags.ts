import type { Clock } from '../../../../../shared/domain/clock';
import { TodoError } from '../../../domain/errors/todo-error';
import { toTagSummaryDto, type TagSummaryDto } from '../../dto/tag.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoUnitOfWork } from '../../ports/todo-unit-of-work';
import { normalizeAssignmentTagIds } from '../../services/tag-assignment';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface ReplaceTodoTagsInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly tagIds: readonly string[];
}

export class ReplaceTodoTags {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly clock: Clock
  ) {}

  async execute(input: ReplaceTodoTagsInput): Promise<{ tags: TagSummaryDto[] }> {
    const tagIds = normalizeAssignmentTagIds(input.tagIds);

    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    return await this.uow.run(async (tx) => {
      const todo = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!todo) {
        throw TodoError.notFound();
      }

      if (tagIds.length > 0) {
        const found = await tx.tags.findByIds(input.workspaceId, tagIds);

        if (found.length !== tagIds.length) {
          throw TodoError.tagWorkspaceMismatch();
        }
      }

      await tx.tags.replaceTodoTags({
        todoId: input.todoId,
        tagIds,
        now: this.clock.now()
      });

      const tagsById = new Map(
        tagIds.length > 0
          ? (await tx.tags.findByIds(input.workspaceId, tagIds)).map((tag) => [tag.id, tag])
          : []
      );

      return {
        tags: tagIds
          .map((tagId) => tagsById.get(tagId))
          .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined)
          .map(toTagSummaryDto)
      };
    });
  }
}
