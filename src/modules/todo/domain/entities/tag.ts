import { TodoError } from '../errors/todo-error';
import {
  METADATA_NAME_MAX_LENGTH,
  normalizeMetadataName,
  type NormalizedMetadataName
} from '../value-objects/metadata-name';

export const TAG_NAME_MAX_LENGTH = METADATA_NAME_MAX_LENGTH;

export interface TagSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTagProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdBy: string;
  readonly now: Date;
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw TodoError.validationError(`${field} harus berupa tanggal yang valid.`);
  }
}

function normalizeName(raw: string): NormalizedMetadataName {
  return normalizeMetadataName(raw, {
    required: () => TodoError.tagNameRequired(),
    tooLong: (maxLength) => TodoError.tagNameTooLong(maxLength),
    invalid: (message) => TodoError.tagNameInvalid(message)
  });
}

/**
 * Tag adalah keyword workspace-scoped yang dapat dipasang pada banyak Todo
 * (many-to-many). Entity ini tidak mengenal Drizzle maupun HTTP.
 */
export class Tag {
  private constructor(private readonly snapshot: TagSnapshot) {}

  static create(props: CreateTagProps): Tag {
    assertValidDate(props.now, 'now');

    const { name, normalizedName } = normalizeName(props.name);

    return new Tag({
      id: props.id,
      workspaceId: props.workspaceId,
      name,
      normalizedName,
      createdBy: props.createdBy,
      createdAt: new Date(props.now.getTime()),
      updatedAt: new Date(props.now.getTime())
    });
  }

  static restore(snapshot: TagSnapshot): Tag {
    const normalized = normalizeName(snapshot.name);

    if (normalized.normalizedName !== snapshot.normalizedName) {
      throw TodoError.tagNameInvalid('normalizedName tidak konsisten dengan name.');
    }

    assertValidDate(snapshot.createdAt, 'createdAt');
    assertValidDate(snapshot.updatedAt, 'updatedAt');

    return new Tag({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get workspaceId(): string {
    return this.snapshot.workspaceId;
  }

  get name(): string {
    return this.snapshot.name;
  }

  get normalizedName(): string {
    return this.snapshot.normalizedName;
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

  rename(name: string, now: Date): Tag {
    assertValidDate(now, 'now');

    const normalized = normalizeName(name);

    return new Tag({
      ...this.snapshot,
      name: normalized.name,
      normalizedName: normalized.normalizedName,
      updatedAt: new Date(now.getTime())
    });
  }

  toSnapshot(): TagSnapshot {
    return {
      id: this.snapshot.id,
      workspaceId: this.snapshot.workspaceId,
      name: this.snapshot.name,
      normalizedName: this.snapshot.normalizedName,
      createdBy: this.snapshot.createdBy,
      createdAt: new Date(this.snapshot.createdAt.getTime()),
      updatedAt: new Date(this.snapshot.updatedAt.getTime())
    };
  }
}
