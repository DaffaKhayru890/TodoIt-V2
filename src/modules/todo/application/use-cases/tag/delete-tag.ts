import { TodoError } from '../../../domain/errors/todo-error';
import type { TagRepository } from '../../../domain/repositories/tag.repository';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface DeleteTagInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly tagId: string;
}

export class DeleteTag {
  constructor(
    private readonly tags: TagRepository,
    private readonly access: TodoAccessService
  ) {}

  /**
   * Hard delete. Association todo_tags ikut terhapus melalui ON DELETE CASCADE;
   * Todo itu sendiri tidak pernah ikut terhapus.
   */
  async execute(input: DeleteTagInput): Promise<void> {
    await this.access.assertAccess(
      input.workspaceId,
      input.userId,
      TodoAction.MANAGE_METADATA
    );

    const deleted = await this.tags.delete(input.workspaceId, input.tagId);

    if (!deleted) {
      throw TodoError.tagNotFound();
    }
  }
}
