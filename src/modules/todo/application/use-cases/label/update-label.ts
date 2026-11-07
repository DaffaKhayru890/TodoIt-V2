import type { Clock } from '../../../../../shared/domain/clock';
import { TodoError } from '../../../domain/errors/todo-error';
import type { LabelRepository } from '../../../domain/repositories/label.repository';
import { toLabelDto, type LabelDto } from '../../dto/label.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface UpdateLabelInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly labelId: string;
  readonly name?: string | undefined;
  readonly color?: string | undefined;
  readonly description?: string | null | undefined;
}

export class UpdateLabel {
  constructor(
    private readonly labels: LabelRepository,
    private readonly access: TodoAccessService,
    private readonly clock: Clock
  ) {}

  async execute(input: UpdateLabelInput): Promise<LabelDto> {
    const hasUpdatableField =
      input.name !== undefined ||
      input.color !== undefined ||
      input.description !== undefined;

    if (!hasUpdatableField) {
      throw TodoError.validationError('Minimal satu field harus diubah.');
    }

    await this.access.assertAccess(
      input.workspaceId,
      input.userId,
      TodoAction.MANAGE_METADATA
    );

    const existing = await this.labels.findById(input.workspaceId, input.labelId);

    if (!existing) {
      throw TodoError.labelNotFound();
    }

    const updated = await this.labels.update(
      existing.update(
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.description !== undefined ? { description: input.description } : {})
        },
        this.clock.now()
      )
    );

    if (!updated) {
      throw TodoError.labelNotFound();
    }

    return toLabelDto(updated);
  }
}
