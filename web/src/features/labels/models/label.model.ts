export interface Label {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly color: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LabelPagination {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface LabelListResult {
  readonly items: readonly Label[];
  readonly pagination: LabelPagination;
}

export interface CreateLabelInput {
  readonly name: string;
  readonly color: string;
  readonly description: string | null;
}

export interface UpdateLabelInput {
  readonly name?: string;
  readonly color?: string;
  readonly description?: string | null;
}

export interface ListLabelsParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly q?: string;
}
