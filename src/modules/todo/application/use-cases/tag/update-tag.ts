import type { Clock } from '../../../../../shared/domain/clock';
import { TodoError } from '../../../domain/errors/todo-error';
import type { TagRepository } from '../../../domain/repositories/tag.repository';
import { toTagDto, type TagDto } from '../../dto/tag.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface UpdateTagInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly tagId: string;
  readonly name?: string | undefined;
}

export class UpdateTag {
  constructor(
    private readonly tags: TagRepository,
    private readonly access: TodoAccessService,
    private readonly clock: Clock
  ) {}

  async execute(input: UpdateTagInput): Promise<TagDto> {
    if (input.name === undefined) {
      throw TodoError.validationError('Minimal satu field harus diubah.');
    }

    await this.access.assertAccess(
      input.workspaceId,
      input.userId,
      TodoAction.MANAGE_METADATA
    );

    const existing = await this.tags.findById(input.workspaceId, input.tagId);

    if (!existing) {
      throw TodoError.tagNotFound();
    }

    const updated = await this.tags.update(existing.rename(input.name, this.clock.now()));

    if (!updated) {
      throw TodoError.tagNotFound();
    }

    return toTagDto(updated);
  }
}
