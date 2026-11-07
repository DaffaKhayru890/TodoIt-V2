import type { Label } from '../entities/label';

/** Posisi keyset untuk listing Label: pasangan (createdAt, id). */
export interface LabelCursorPosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface LabelListQuery {
  readonly workspaceId: string;
  readonly search?: string;
  readonly cursor: LabelCursorPosition | null;
  readonly limit: number;
}

export interface LabelListResult {
  readonly items: readonly Label[];
  readonly hasMore: boolean;
}

/**
 * Kontrak repository Label. Setiap query dibatasi workspace; penghapusan Label
 * memakai hard delete dan database menetapkan `todos.label_id` menjadi NULL
 * melalui ON DELETE SET NULL.
 */
export interface LabelRepository {
  /** Melempar LABEL_ALREADY_EXISTS bila normalized name sudah dipakai. */
  create(label: Label): Promise<Label>;

  findById(workspaceId: string, labelId: string): Promise<Label | null>;

  findByIds(workspaceId: string, labelIds: readonly string[]): Promise<readonly Label[]>;

  findByName(workspaceId: string, normalizedName: string): Promise<Label | null>;

  update(label: Label): Promise<Label | null>;

  delete(workspaceId: string, labelId: string): Promise<boolean>;

  list(query: LabelListQuery): Promise<LabelListResult>;
}
