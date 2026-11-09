export interface LabelDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly color: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LabelPaginationDto {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface ListLabelsResponseDto {
  readonly items: readonly LabelDto[];
  readonly pagination: LabelPaginationDto;
}

export interface LabelResponseDto {
  readonly label: LabelDto;
}

export interface CreateLabelRequestDto {
  readonly name: string;
  readonly color: string;
  readonly description?: string | null;
}

export interface UpdateLabelRequestDto {
  readonly name?: string;
  readonly color?: string;
  readonly description?: string | null;
}

export interface AssignTodoLabelRequestDto {
  readonly labelId: string;
}
