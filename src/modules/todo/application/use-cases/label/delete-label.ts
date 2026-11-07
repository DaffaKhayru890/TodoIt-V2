import { TodoError } from '../../../domain/errors/todo-error';
import type { LabelRepository } from '../../../domain/repositories/label.repository';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface DeleteLabelInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly labelId: string;
}

export class DeleteLabel {
  constructor(
    private readonly labels: LabelRepository,
    private readonly access: TodoAccessService
  ) {}

  /**
   * Hard delete. `todos.label_id` menjadi NULL melalui ON DELETE SET NULL;
   * Todo tidak ikut terhapus dan data lainnya tidak berubah.
   */
  async execute(input: DeleteLabelInput): Promise<void> {
    await this.access.assertAccess(
      input.workspaceId,
      input.userId,
      TodoAction.MANAGE_METADATA
    );

    const deleted = await this.labels.delete(input.workspaceId, input.labelId);

    if (!deleted) {
      throw TodoError.labelNotFound();
    }
  }
}
