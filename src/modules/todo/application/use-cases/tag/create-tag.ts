import type { Clock } from '../../../../../shared/domain/clock';
import { Tag } from '../../../domain/entities/tag';
import type { TagRepository } from '../../../domain/repositories/tag.repository';
import { toTagDto, type TagDto } from '../../dto/tag.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface CreateTagInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly name: string;
}

export class CreateTag {
  constructor(
    private readonly tags: TagRepository,
    private readonly access: TodoAccessService,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateTagInput): Promise<TagDto> {
    await this.access.assertAccess(
      input.workspaceId,
      input.userId,
      TodoAction.MANAGE_METADATA
    );

    const tag = Tag.create({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      createdBy: input.userId,
      now: this.clock.now()
    });

    const created = await this.tags.create(tag);

    return toTagDto(created);
  }
}
