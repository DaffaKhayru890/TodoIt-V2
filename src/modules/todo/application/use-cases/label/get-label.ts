import { TodoError } from '../../../domain/errors/todo-error';
import type { LabelRepository } from '../../../domain/repositories/label.repository';
import { toLabelDto, type LabelDto } from '../../dto/label.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface GetLabelInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly labelId: string;
}

export class GetLabel {
  constructor(
    private readonly labels: LabelRepository,
    private readonly access: TodoAccessService
  ) {}

  async execute(input: GetLabelInput): Promise<LabelDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const label = await this.labels.findById(input.workspaceId, input.labelId);

    if (!label) {
      throw TodoError.labelNotFound();
    }

    return toLabelDto(label);
  }
}
