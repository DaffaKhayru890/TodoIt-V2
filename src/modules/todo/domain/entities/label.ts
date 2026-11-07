import { TodoError } from '../errors/todo-error';
import { normalizeLabelColor } from '../value-objects/label-color';
import {
  METADATA_NAME_MAX_LENGTH,
  normalizeMetadataName,
  type NormalizedMetadataName
} from '../value-objects/metadata-name';

export const LABEL_NAME_MAX_LENGTH = METADATA_NAME_MAX_LENGTH;
export const LABEL_DESCRIPTION_MAX_LENGTH = 300;

export interface LabelSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly color: string;
  readonly description: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateLabelProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly color: string;
  readonly description?: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface UpdateLabelProps {
  readonly name?: string;
  readonly color?: string;
  /** undefined berarti tidak berubah; null menghapus deskripsi. */
  readonly description?: string | null;
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw TodoError.validationError(`${field} harus berupa tanggal yang valid.`);
  }
}

function normalizeName(raw: string): NormalizedMetadataName {
  return normalizeMetadataName(raw, {
    required: () => TodoError.labelNameRequired(),
    tooLong: (maxLength) => TodoError.labelNameTooLong(maxLength),
    invalid: (message) => TodoError.labelNameInvalid(message)
  });
}

function normalizeDescription(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  const description = raw.trim();

  if (description.length > LABEL_DESCRIPTION_MAX_LENGTH) {
    throw TodoError.labelDescriptionTooLong(LABEL_DESCRIPTION_MAX_LENGTH);
  }

  return description.length === 0 ? null : description;
}

/**
 * Label adalah kategori utama workspace-scoped. Satu Todo maksimal memiliki
 * satu Label; hubungannya disimpan sebagai `todos.label_id`.
 */
export class Label {
  private constructor(private readonly snapshot: LabelSnapshot) {}

  static create(props: CreateLabelProps): Label {
    assertValidDate(props.now, 'now');

    const { name, normalizedName } = normalizeName(props.name);

    return new Label({
      id: props.id,
      workspaceId: props.workspaceId,
      name,
      normalizedName,
      color: normalizeLabelColor(props.color),
      description: normalizeDescription(props.description),
      createdBy: props.createdBy,
      createdAt: new Date(props.now.getTime()),
      updatedAt: new Date(props.now.getTime())
    });
  }

  static restore(snapshot: LabelSnapshot): Label {
    const normalized = normalizeName(snapshot.name);

    if (normalized.normalizedName !== snapshot.normalizedName) {
      throw TodoError.labelNameInvalid('normalizedName tidak konsisten dengan name.');
    }

    assertValidDate(snapshot.createdAt, 'createdAt');
    assertValidDate(snapshot.updatedAt, 'updatedAt');

    return new Label({
      ...snapshot,
      color: normalizeLabelColor(snapshot.color),
      description: normalizeDescription(snapshot.description)
    });
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

  get color(): string {
    return this.snapshot.color;
  }

  get description(): string | null {
    return this.snapshot.description;
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

  update(changes: UpdateLabelProps, now: Date): Label {
    assertValidDate(now, 'now');

    const normalized =
      changes.name !== undefined ? normalizeName(changes.name) : null;

    return new Label({
      ...this.snapshot,
      name: normalized?.name ?? this.snapshot.name,
      normalizedName: normalized?.normalizedName ?? this.snapshot.normalizedName,
      color:
        changes.color !== undefined ? normalizeLabelColor(changes.color) : this.snapshot.color,
      description:
        changes.description !== undefined
          ? normalizeDescription(changes.description)
          : this.snapshot.description,
      updatedAt: new Date(now.getTime())
    });
  }

  toSnapshot(): LabelSnapshot {
    return {
      id: this.snapshot.id,
      workspaceId: this.snapshot.workspaceId,
      name: this.snapshot.name,
      normalizedName: this.snapshot.normalizedName,
      color: this.snapshot.color,
      description: this.snapshot.description,
      createdBy: this.snapshot.createdBy,
      createdAt: new Date(this.snapshot.createdAt.getTime()),
      updatedAt: new Date(this.snapshot.updatedAt.getTime())
    };
  }
}
