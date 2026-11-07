import type { Clock } from '../../../../../shared/domain/clock';
import { Label } from '../../../domain/entities/label';
import type { LabelRepository } from '../../../domain/repositories/label.repository';
import { toLabelDto, type LabelDto } from '../../dto/label.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface CreateLabelInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  readonly description?: string | null | undefined;
}

export class CreateLabel {
  constructor(
    private readonly labels: LabelRepository,
    private readonly access: TodoAccessService,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateLabelInput): Promise<LabelDto> {
    await this.access.assertAccess(
      input.workspaceId,
      input.userId,
      TodoAction.MANAGE_METADATA
    );

    const label = Label.create({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      color: input.color,
      description: input.description ?? null,
      createdBy: input.userId,
      now: this.clock.now()
    });

    const created = await this.labels.create(label);

    return toLabelDto(created);
  }
}
