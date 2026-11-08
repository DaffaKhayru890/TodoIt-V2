/**
 * Bentuk response backend `GET/POST/PATCH /api/v1/workspaces/:workspaceId/todos`.
 *
 * Backend menyerialisasikan `Date` menjadi string ISO 8601. DTO sengaja
 * memakai tipe primitif agar respons yang rusak dapat dideteksi runtime
 * sebelum dipetakan ke domain model.
 */
export interface TodoLabelDto {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface TodoTagDto {
  readonly id: string;
  readonly name: string;
}

export interface TodoDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly dueAt: string | null;
  readonly completedAt: string | null;
  readonly label: TodoLabelDto | null;
  readonly tags: readonly TodoTagDto[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TodoPaginationDto {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface TodoListResponseDto {
  readonly items: readonly TodoDto[];
  readonly pagination: TodoPaginationDto;
}

export interface TodoResponseDto {
  readonly todo: TodoDto;
}

export interface CreateTodoRequestDto {
  readonly title: string;
  readonly description?: string | null;
}

export interface UpdateTodoRequestDto {
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: string;
}
