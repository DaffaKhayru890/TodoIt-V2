import { TodoError } from '../errors/todo-error';
import { TodoPriority, isTodoPriority } from '../enums/todo-priority';
import { TodoStatus, isTodoStatus } from '../enums/todo-status';

export const TODO_TITLE_MAX_LENGTH = 200;
export const TODO_DESCRIPTION_MAX_LENGTH = 5000;

/**
 * Representasi Todo yang sepenuhnya independen dari Drizzle/PostgreSQL.
 * Seluruh invariant bisnis dijaga di sini, sehingga use case tidak perlu
 * (dan tidak boleh) mengandalkan constraint database sebagai satu-satunya
 * pelindung.
 */
export interface TodoSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TodoStatus;
  readonly priority: TodoPriority;
  readonly dueAt: Date | null;
  readonly completedAt: Date | null;
  /** Label utama (maksimal satu). null berarti tanpa label. */
  readonly labelId?: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface CreateTodoProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  /** undefined/null berarti tanpa deskripsi. */
  readonly description?: string | null;
  /** Default LOW bila tidak diberikan. */
  readonly priority?: TodoPriority;
  readonly dueAt?: Date | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface UpdateTodoProps {
  readonly title?: string;
  /** null menghapus deskripsi; undefined berarti tidak berubah. */
  readonly description?: string | null;
  readonly status?: TodoStatus;
  readonly priority?: TodoPriority;
  /** null menghapus due date; undefined berarti tidak berubah. */
  readonly dueAt?: Date | null;
  /** null menghapus label; undefined berarti tidak berubah. */
  readonly labelId?: string | null;
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw TodoError.validationError(`${field} harus berupa tanggal yang valid.`);
  }
}

function normalizeTitle(value: string): string {
  const title = value.trim();

  if (title.length === 0) {
    throw TodoError.titleRequired();
  }

  if (title.length > TODO_TITLE_MAX_LENGTH) {
    throw TodoError.titleTooLong(TODO_TITLE_MAX_LENGTH);
  }

  return title;
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const description = value.trim();

  if (description.length > TODO_DESCRIPTION_MAX_LENGTH) {
    throw TodoError.descriptionTooLong(TODO_DESCRIPTION_MAX_LENGTH);
  }

  return description.length === 0 ? null : description;
}

function normalizeDueAt(value: Date | null | undefined): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  assertValidDate(value, 'dueAt');

  return new Date(value.getTime());
}

function assertCompletedAtConsistency(status: TodoStatus, completedAt: Date | null): void {
  if (status === TodoStatus.COMPLETED && completedAt === null) {
    // Invariant internal: status completed selalu memiliki completedAt.
    throw TodoError.validationError('Todo berstatus completed harus memiliki completedAt.');
  }

  if (status !== TodoStatus.COMPLETED && completedAt !== null) {
    throw TodoError.validationError('completedAt hanya boleh diisi ketika status completed.');
  }
}

export class Todo {
  private constructor(private readonly snapshot: TodoSnapshot) {}

  static create(props: CreateTodoProps): Todo {
    assertValidDate(props.now, 'now');

    if (props.priority !== undefined && !isTodoPriority(props.priority)) {
      throw TodoError.invalidPriority();
    }

    return new Todo({
      id: props.id,
      workspaceId: props.workspaceId,
      title: normalizeTitle(props.title),
      description: normalizeDescription(props.description),
      status: TodoStatus.TODO,
      priority: props.priority ?? TodoPriority.LOW,
      dueAt: normalizeDueAt(props.dueAt),
      completedAt: null,
      labelId: null,
      createdBy: props.createdBy,
      createdAt: new Date(props.now.getTime()),
      updatedAt: new Date(props.now.getTime()),
      deletedAt: null
    });
  }

  /**
   * Rehidrasi dari persistence. Dipakai mapper infrastructure; tetap memeriksa
   * konsistensi status/completedAt agar baris database yang korup tidak diam-diam
   * menjadi entity yang tidak valid.
   */
  static restore(snapshot: TodoSnapshot): Todo {
    if (!isTodoStatus(snapshot.status)) {
      throw TodoError.invalidStatus();
    }

    if (!isTodoPriority(snapshot.priority)) {
      throw TodoError.invalidPriority();
    }

    assertValidDate(snapshot.createdAt, 'createdAt');
    assertValidDate(snapshot.updatedAt, 'updatedAt');
    assertCompletedAtConsistency(snapshot.status, snapshot.completedAt);

    return new Todo({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get workspaceId(): string {
    return this.snapshot.workspaceId;
  }

  get title(): string {
    return this.snapshot.title;
  }

  get description(): string | null {
    return this.snapshot.description;
  }

  get status(): TodoStatus {
    return this.snapshot.status;
  }

  get priority(): TodoPriority {
    return this.snapshot.priority;
  }

  get dueAt(): Date | null {
    return this.snapshot.dueAt ? new Date(this.snapshot.dueAt.getTime()) : null;
  }

  get completedAt(): Date | null {
    return this.snapshot.completedAt ? new Date(this.snapshot.completedAt.getTime()) : null;
  }

  get labelId(): string | null {
    return this.snapshot.labelId ?? null;
  }

  get createdBy(): string {
    return this.snapshot.createdBy;
  }

  get createdAt(): Date {
    return new Date(this.snapshot.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.snapshot.updatedAt.getTime());
  }

  get deletedAt(): Date | null {
    return this.snapshot.deletedAt ? new Date(this.snapshot.deletedAt.getTime()) : null;
  }

  get isDeleted(): boolean {
    return this.snapshot.deletedAt !== null;
  }

  /**
   * Menerapkan perubahan yang diizinkan client. Metadata internal (id,
   * workspaceId, createdBy, createdAt, updatedAt, deletedAt) tidak pernah
   * diterima di sini.
   */
  update(changes: UpdateTodoProps, now: Date): Todo {
    if (this.isDeleted) {
      throw TodoError.notFound();
    }

    assertValidDate(now, 'now');

    const nextStatus = changes.status ?? this.snapshot.status;

    if (!isTodoStatus(nextStatus)) {
      throw TodoError.invalidStatus();
    }

    const nextPriority = changes.priority ?? this.snapshot.priority;

    if (!isTodoPriority(nextPriority)) {
      throw TodoError.invalidPriority();
    }

    let nextCompletedAt = this.snapshot.completedAt;

    if (nextStatus === TodoStatus.COMPLETED) {
      // Tetap completed: pertahankan completedAt yang sudah ada. Transisi masuk
      // ke completed: isi dengan waktu server (Clock).
      nextCompletedAt = this.snapshot.status === TodoStatus.COMPLETED ? this.snapshot.completedAt ?? now : new Date(now.getTime());
    } else {
      // Termasuk transisi ke CANCELLED dan reopen dari COMPLETED.
      nextCompletedAt = null;
    }

    assertCompletedAtConsistency(nextStatus, nextCompletedAt);

    return new Todo({
      ...this.snapshot,
      title: changes.title !== undefined ? normalizeTitle(changes.title) : this.snapshot.title,
      description:
        changes.description !== undefined
          ? normalizeDescription(changes.description)
          : this.snapshot.description,
      status: nextStatus,
      priority: nextPriority,
      dueAt: changes.dueAt !== undefined ? normalizeDueAt(changes.dueAt) : this.snapshot.dueAt,
      completedAt: nextCompletedAt,
      labelId: changes.labelId !== undefined ? changes.labelId : (this.snapshot.labelId ?? null),
      updatedAt: new Date(now.getTime())
    });
  }

  /** Shortcut idempoten: mengulang complete tidak menggeser timestamp. */
  complete(now: Date): Todo {
    if (this.isDeleted) {
      throw TodoError.notFound();
    }

    if (this.snapshot.status === TodoStatus.COMPLETED) {
      return this;
    }

    return this.update({ status: TodoStatus.COMPLETED }, now);
  }

  /** Soft delete; record fisik tidak pernah dihapus pada Phase 3. */
  softDelete(now: Date): Todo {
    if (this.isDeleted) {
      return this;
    }

    assertValidDate(now, 'now');

    return new Todo({
      ...this.snapshot,
      deletedAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime())
    });
  }

  toSnapshot(): TodoSnapshot {
    return {
      id: this.snapshot.id,
      workspaceId: this.snapshot.workspaceId,
      title: this.snapshot.title,
      description: this.snapshot.description,
      status: this.snapshot.status,
      priority: this.snapshot.priority,
      dueAt: this.snapshot.dueAt ? new Date(this.snapshot.dueAt.getTime()) : null,
      completedAt: this.snapshot.completedAt ? new Date(this.snapshot.completedAt.getTime()) : null,
      labelId: this.snapshot.labelId ?? null,
      createdBy: this.snapshot.createdBy,
      createdAt: new Date(this.snapshot.createdAt.getTime()),
      updatedAt: new Date(this.snapshot.updatedAt.getTime()),
      deletedAt: this.snapshot.deletedAt ? new Date(this.snapshot.deletedAt.getTime()) : null
    };
  }
}
