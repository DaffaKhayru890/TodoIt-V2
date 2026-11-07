import type { CreateLabel } from '../../application/use-cases/label/create-label';
import type { ListLabels } from '../../application/use-cases/label/list-labels';
import type { GetLabel } from '../../application/use-cases/label/get-label';
import type { UpdateLabel } from '../../application/use-cases/label/update-label';
import type { DeleteLabel } from '../../application/use-cases/label/delete-label';
import type { LabelDto, LabelListResponseDto } from '../../application/dto/label.dto';

export interface CreateLabelBody {
  readonly name: string;
  readonly color: string;
  readonly description?: string | null | undefined;
}

export interface UpdateLabelBody {
  readonly name?: string | undefined;
  readonly color?: string | undefined;
  readonly description?: string | null | undefined;
}

export interface ListLabelsQuery {
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly q?: string | undefined;
}

export interface LabelHandlers {
  create(
    userId: string,
    workspaceId: string,
    body: CreateLabelBody
  ): Promise<{ label: LabelDto }>;
  list(
    userId: string,
    workspaceId: string,
    query: ListLabelsQuery
  ): Promise<LabelListResponseDto>;
  get(userId: string, workspaceId: string, labelId: string): Promise<{ label: LabelDto }>;
  update(
    userId: string,
    workspaceId: string,
    labelId: string,
    body: UpdateLabelBody
  ): Promise<{ label: LabelDto }>;
  remove(userId: string, workspaceId: string, labelId: string): Promise<void>;
}

export function createLabelHandlers(deps: {
  readonly createLabel: CreateLabel;
  readonly listLabels: ListLabels;
  readonly getLabel: GetLabel;
  readonly updateLabel: UpdateLabel;
  readonly deleteLabel: DeleteLabel;
}): LabelHandlers {
  return {
    async create(userId, workspaceId, body) {
      const label = await deps.createLabel.execute({
        workspaceId,
        userId,
        name: body.name,
        color: body.color,
        description: body.description
      });

      return { label };
    },

    async list(userId, workspaceId, query) {
      return await deps.listLabels.execute({
        workspaceId,
        userId,
        limit: query.limit,
        cursor: query.cursor,
        q: query.q
      });
    },

    async get(userId, workspaceId, labelId) {
      const label = await deps.getLabel.execute({ workspaceId, userId, labelId });

      return { label };
    },

    async update(userId, workspaceId, labelId, body) {
      const label = await deps.updateLabel.execute({
        workspaceId,
        userId,
        labelId,
        name: body.name,
        color: body.color,
        description: body.description
      });

      return { label };
    },

    async remove(userId, workspaceId, labelId) {
      await deps.deleteLabel.execute({ workspaceId, userId, labelId });
    }
  };
}
