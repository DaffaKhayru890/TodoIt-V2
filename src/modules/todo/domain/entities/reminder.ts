import { TodoError } from '../errors/todo-error';
import {
  ReminderStatus,
  isReminderStatus
} from '../enums/reminder-status';
import {
  ReminderTriggerType,
  isReminderTriggerType
} from '../enums/reminder-trigger-type';

export const REMINDER_OFFSET_MIN_MINUTES = 1;
/** 43200 menit = 30 hari. */
export const REMINDER_OFFSET_MAX_MINUTES = 43_200;

const MILLISECONDS_PER_MINUTE = 60_000;

export interface ReminderSnapshot {
  readonly id: string;
  readonly todoId: string;
  readonly createdBy: string;
  readonly triggerType: ReminderTriggerType;
  readonly remindAt: Date | null;
  readonly offsetMinutes: number | null;
  readonly status: ReminderStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly cancelledAt: Date | null;
}

export interface CreateReminderProps {
  readonly id: string;
  readonly todoId: string;
  readonly createdBy: string;
  readonly triggerType: ReminderTriggerType;
  readonly remindAt?: Date | null;
  readonly offsetMinutes?: number | null;
  readonly now: Date;
}

export interface UpdateReminderScheduleProps {
  /** Hanya untuk trigger absolute. */
  readonly remindAt?: Date;
  /** Hanya untuk trigger before_due. */
  readonly offsetMinutes?: number;
}

function assertValidDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw TodoError.reminderTimeInvalid(`${field} harus berupa tanggal yang valid.`);
  }
}

export function assertReminderOffset(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < REMINDER_OFFSET_MIN_MINUTES ||
    value > REMINDER_OFFSET_MAX_MINUTES
  ) {
    throw TodoError.reminderOffsetInvalid();
  }

  return value;
}

/**
 * Menghitung waktu efektif reminder.
 *
 * Satu-satunya sumber kebenaran adalah `remindAt` (absolute) atau
 * `dueAt - offsetMinutes` (before_due). Tidak ada kolom effectiveAt terpisah
 * supaya perubahan dueAt tidak pernah membuat data menjadi tidak sinkron.
 */
export function computeReminderEffectiveAt(
  triggerType: ReminderTriggerType,
  remindAt: Date | null,
  offsetMinutes: number | null,
  dueAt: Date | null
): Date | null {
  if (triggerType === ReminderTriggerType.ABSOLUTE) {
    return remindAt ? new Date(remindAt.getTime()) : null;
  }

  if (dueAt === null || offsetMinutes === null) {
    return null;
  }

  return new Date(dueAt.getTime() - offsetMinutes * MILLISECONDS_PER_MINUTE);
}

function assertTriggerShape(
  triggerType: ReminderTriggerType,
  remindAt: Date | null,
  offsetMinutes: number | null
): void {
  if (triggerType === ReminderTriggerType.ABSOLUTE) {
    if (remindAt === null || offsetMinutes !== null) {
      throw TodoError.reminderTimeInvalid(
        'Reminder absolute wajib memiliki remindAt dan tidak boleh memiliki offsetMinutes.'
      );
    }

    assertValidDate(remindAt, 'remindAt');
    return;
  }

  if (remindAt !== null) {
    throw TodoError.reminderTimeInvalid('Reminder before_due tidak boleh memiliki remindAt.');
  }

  assertReminderOffset(offsetMinutes);
}

/**
 * Reminder adalah jadwal pengingat milik satu Todo. Entity tidak mengirim
 * notifikasi; ia hanya menjaga konsistensi jadwal dan lifecycle.
 */
export class Reminder {
  private constructor(private readonly snapshot: ReminderSnapshot) {}

  static create(props: CreateReminderProps): Reminder {
    assertValidDate(props.now, 'now');

    if (!isReminderTriggerType(props.triggerType)) {
      throw TodoError.reminderTriggerTypeInvalid();
    }

    const remindAt =
      props.remindAt === undefined || props.remindAt === null
        ? null
        : new Date(props.remindAt.getTime());
    const offsetMinutes = props.offsetMinutes ?? null;

    assertTriggerShape(props.triggerType, remindAt, offsetMinutes);

    return new Reminder({
      id: props.id,
      todoId: props.todoId,
      createdBy: props.createdBy,
      triggerType: props.triggerType,
      remindAt,
      offsetMinutes,
      status: ReminderStatus.SCHEDULED,
      createdAt: new Date(props.now.getTime()),
      updatedAt: new Date(props.now.getTime()),
      cancelledAt: null
    });
  }

  static restore(snapshot: ReminderSnapshot): Reminder {
    if (!isReminderTriggerType(snapshot.triggerType)) {
      throw TodoError.reminderTriggerTypeInvalid();
    }

    if (!isReminderStatus(snapshot.status)) {
      throw TodoError.reminderTimeInvalid('Status reminder tidak valid.');
    }

    assertTriggerShape(snapshot.triggerType, snapshot.remindAt, snapshot.offsetMinutes);
    assertValidDate(snapshot.createdAt, 'createdAt');
    assertValidDate(snapshot.updatedAt, 'updatedAt');

    if (snapshot.status === ReminderStatus.CANCELLED && snapshot.cancelledAt === null) {
      throw TodoError.reminderTimeInvalid('Reminder cancelled wajib memiliki cancelledAt.');
    }

    if (snapshot.status === ReminderStatus.SCHEDULED && snapshot.cancelledAt !== null) {
      throw TodoError.reminderTimeInvalid('Reminder scheduled tidak boleh memiliki cancelledAt.');
    }

    if (snapshot.cancelledAt !== null) {
      assertValidDate(snapshot.cancelledAt, 'cancelledAt');
    }

    return new Reminder({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get todoId(): string {
    return this.snapshot.todoId;
  }

  get createdBy(): string {
    return this.snapshot.createdBy;
  }

  get triggerType(): ReminderTriggerType {
    return this.snapshot.triggerType;
  }

  get remindAt(): Date | null {
    return this.snapshot.remindAt ? new Date(this.snapshot.remindAt.getTime()) : null;
  }

  get offsetMinutes(): number | null {
    return this.snapshot.offsetMinutes;
  }

  get status(): ReminderStatus {
    return this.snapshot.status;
  }

  get createdAt(): Date {
    return new Date(this.snapshot.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.snapshot.updatedAt.getTime());
  }

  get cancelledAt(): Date | null {
    return this.snapshot.cancelledAt ? new Date(this.snapshot.cancelledAt.getTime()) : null;
  }

  get isCancelled(): boolean {
    return this.snapshot.status === ReminderStatus.CANCELLED;
  }

  effectiveAt(dueAt: Date | null): Date | null {
    return computeReminderEffectiveAt(
      this.snapshot.triggerType,
      this.snapshot.remindAt,
      this.snapshot.offsetMinutes,
      dueAt
    );
  }

  /**
   * Trigger type immutable. Reminder yang sudah cancelled tidak dapat
   * dijadwalkan ulang; client harus membuat reminder baru.
   */
  updateSchedule(changes: UpdateReminderScheduleProps, now: Date): Reminder {
    assertValidDate(now, 'now');

    if (this.isCancelled) {
      throw TodoError.reminderAlreadyCancelled();
    }

    if (this.snapshot.triggerType === ReminderTriggerType.ABSOLUTE) {
      if (changes.offsetMinutes !== undefined) {
        throw TodoError.reminderTimeInvalid('Reminder absolute hanya dapat mengubah remindAt.');
      }

      if (changes.remindAt === undefined) {
        throw TodoError.reminderTimeInvalid('remindAt wajib diberikan untuk reminder absolute.');
      }

      assertValidDate(changes.remindAt, 'remindAt');

      return new Reminder({
        ...this.snapshot,
        remindAt: new Date(changes.remindAt.getTime()),
        updatedAt: new Date(now.getTime())
      });
    }

    if (changes.remindAt !== undefined) {
      throw TodoError.reminderTimeInvalid('Reminder before_due hanya dapat mengubah offsetMinutes.');
    }

    if (changes.offsetMinutes === undefined) {
      throw TodoError.reminderTimeInvalid(
        'offsetMinutes wajib diberikan untuk reminder before_due.'
      );
    }

    return new Reminder({
      ...this.snapshot,
      offsetMinutes: assertReminderOffset(changes.offsetMinutes),
      updatedAt: new Date(now.getTime())
    });
  }

  /** Cancel idempoten: pengulangan tidak menggeser cancelledAt/updatedAt. */
  cancel(now: Date): Reminder {
    assertValidDate(now, 'now');

    if (this.isCancelled) {
      return this;
    }

    return new Reminder({
      ...this.snapshot,
      status: ReminderStatus.CANCELLED,
      cancelledAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime())
    });
  }

  toSnapshot(): ReminderSnapshot {
    return {
      id: this.snapshot.id,
      todoId: this.snapshot.todoId,
      createdBy: this.snapshot.createdBy,
      triggerType: this.snapshot.triggerType,
      remindAt: this.snapshot.remindAt ? new Date(this.snapshot.remindAt.getTime()) : null,
      offsetMinutes: this.snapshot.offsetMinutes,
      status: this.snapshot.status,
      createdAt: new Date(this.snapshot.createdAt.getTime()),
      updatedAt: new Date(this.snapshot.updatedAt.getTime()),
      cancelledAt: this.snapshot.cancelledAt
        ? new Date(this.snapshot.cancelledAt.getTime())
        : null
    };
  }
}
