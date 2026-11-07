import type { Tag } from '../entities/tag';

/** Posisi keyset untuk listing Tag: pasangan (createdAt, id). */
export interface TagCursorPosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface TagListQuery {
  readonly workspaceId: string;
  readonly search?: string;
  readonly cursor: TagCursorPosition | null;
  /** Repository mengambil limit + 1 untuk menentukan hasMore. */
  readonly limit: number;
}

export interface TagListResult {
  readonly items: readonly Tag[];
  readonly hasMore: boolean;
}

export interface ReplaceTodoTagsCommand {
  readonly todoId: string;
  readonly tagIds: readonly string[];
  readonly now: Date;
}

export interface AddTodoTagCommand {
  readonly todoId: string;
  readonly tagId: string;
  readonly now: Date;
}

/**
 * Kontrak repository Tag beserta association many-to-many ke Todo.
 *
 * Semua method yang menerima workspaceId WAJIB membatasi query pada workspace
 * tersebut. Validasi membership adalah tanggung jawab application layer.
 */
export interface TagRepository {
  /** Melempar TAG_ALREADY_EXISTS bila normalized name sudah dipakai. */
  create(tag: Tag): Promise<Tag>;

  findById(workspaceId: string, tagId: string): Promise<Tag | null>;

  /** Hanya mengembalikan Tag yang benar-benar berada pada workspace tersebut. */
  findByIds(workspaceId: string, tagIds: readonly string[]): Promise<readonly Tag[]>;

  findByName(workspaceId: string, normalizedName: string): Promise<Tag | null>;

  update(tag: Tag): Promise<Tag | null>;

  /** Hard delete; association todo_tags ikut terhapus melalui cascade. */
  delete(workspaceId: string, tagId: string): Promise<boolean>;

  list(query: TagListQuery): Promise<TagListResult>;

  /** Batch loading untuk menghindari N+1 pada listing Todo. */
  findByTodoIds(todoIds: readonly string[]): Promise<ReadonlyMap<string, readonly Tag[]>>;

  findTodoTagIds(todoId: string): Promise<readonly string[]>;

  countTodoTags(todoId: string): Promise<number>;

  /** Mengganti seluruh association Todo secara atomik. */
  replaceTodoTags(command: ReplaceTodoTagsCommand): Promise<void>;

  /** Idempoten; mengembalikan true bila association baru benar-benar dibuat. */
  addTodoTag(command: AddTodoTagCommand): Promise<boolean>;

  /** Idempoten; mengembalikan true bila association dihapus. */
  removeTodoTag(todoId: string, tagId: string): Promise<boolean>;
}
