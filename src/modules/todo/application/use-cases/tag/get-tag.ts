import { TodoError } from '../../../domain/errors/todo-error';
import type { TagRepository } from '../../../domain/repositories/tag.repository';
import { toTagDto, type TagDto } from '../../dto/tag.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface GetTagInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly tagId: string;
}

export class GetTag {
  constructor(
    private readonly tags: TagRepository,
    private readonly access: TodoAccessService
  ) {}

  async execute(input: GetTagInput): Promise<TagDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const tag = await this.tags.findById(input.workspaceId, input.tagId);

    if (!tag) {
      throw TodoError.tagNotFound();
    }

    return toTagDto(tag);
  }
}
