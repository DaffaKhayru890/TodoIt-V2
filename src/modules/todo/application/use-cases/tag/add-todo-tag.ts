import type { Clock } from '../../../../../shared/domain/clock';
import { TodoError } from '../../../domain/errors/todo-error';
import { toTagSummaryDto, type TagSummaryDto } from '../../dto/tag.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoUnitOfWork } from '../../ports/todo-unit-of-work';
import { MAX_TAGS_PER_TODO } from '../../services/tag-assignment';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface AddTodoTagInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly tagId: string;
}

export class AddTodoTag {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly clock: Clock
  ) {}

  async execute(input: AddTodoTagInput): Promise<{ tags: TagSummaryDto[] }> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    return await this.uow.run(async (tx) => {
      const todo = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!todo) {
        throw TodoError.notFound();
      }

      const tag = await tx.tags.findById(input.workspaceId, input.tagId);

      if (!tag) {
        throw TodoError.tagNotFound();
      }

      const currentIds = await tx.tags.findTodoTagIds(input.todoId);

      if (!currentIds.includes(input.tagId)) {
        if (currentIds.length >= MAX_TAGS_PER_TODO) {
          throw TodoError.tagLimitExceeded(MAX_TAGS_PER_TODO);
        }

        await tx.tags.addTodoTag({
          todoId: input.todoId,
          tagId: input.tagId,
          now: this.clock.now()
        });
      }

      const tags = await tx.tags.findByTodoIds([input.todoId]);

      return { tags: (tags.get(input.todoId) ?? []).map(toTagSummaryDto) };
    });
  }
}
