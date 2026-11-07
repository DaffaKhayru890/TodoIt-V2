import { ApplicationError } from '../../../../shared/domain/errors/application-error';

/**
 * Kode error domain Todo (termasuk metadata Tag/Label/Reminder pada Phase 4).
 * Semua nilai stabil dan dipetakan ke HTTP oleh presentation layer; domain
 * tidak mengenal status code.
 */
export const TODO_ERROR_CODES = [
  'TODO_NOT_FOUND',
  'TODO_TITLE_REQUIRED',
  'TODO_TITLE_TOO_LONG',
  'TODO_DESCRIPTION_TOO_LONG',
  'TODO_STATUS_INVALID',
  'TODO_PRIORITY_INVALID',
  'TODO_DUE_DATE_INVALID',
  'TODO_LABEL_ASSIGNMENT_INVALID',
  'TODO_TAG_ASSIGNMENT_INVALID',
  'TODO_HAS_RELATIVE_REMINDERS',
  'TODO_DUE_DATE_CONFLICTS_WITH_REMINDERS',
  'TAG_NOT_FOUND',
  'TAG_NAME_REQUIRED',
  'TAG_NAME_INVALID',
  'TAG_NAME_TOO_LONG',
  'TAG_ALREADY_EXISTS',
  'TAG_WORKSPACE_MISMATCH',
  'TAG_LIMIT_EXCEEDED',
  'TAG_ASSIGNMENT_INVALID',
  'LABEL_NOT_FOUND',
  'LABEL_NAME_REQUIRED',
  'LABEL_NAME_INVALID',
  'LABEL_NAME_TOO_LONG',
  'LABEL_ALREADY_EXISTS',
  'LABEL_COLOR_INVALID',
  'LABEL_DESCRIPTION_TOO_LONG',
  'LABEL_WORKSPACE_MISMATCH',
  'REMINDER_NOT_FOUND',
  'REMINDER_TRIGGER_TYPE_INVALID',
  'REMINDER_TIME_INVALID',
  'REMINDER_TIME_IN_PAST',
  'REMINDER_OFFSET_INVALID',
  'REMINDER_ALREADY_CANCELLED',
  'REMINDER_DUPLICATE',
  'REMINDER_TODO_INELIGIBLE',
  'REMINDER_DUE_DATE_REQUIRED',
  'REMINDER_SCHEDULE_CONFLICT',
  'REMINDER_WORKSPACE_MISMATCH',
  'INVALID_CURSOR',
  'INVALID_DATE_RANGE',
  'INVALID_TIMEZONE',
  'INVALID_UPCOMING_RANGE',
  'WORKSPACE_ACCESS_DENIED',
  'WORKSPACE_PERMISSION_DENIED',
  'VALIDATION_ERROR'
] as const;

export type TodoErrorCode = (typeof TODO_ERROR_CODES)[number];

export class TodoError extends ApplicationError {
  readonly code: TodoErrorCode;

  private constructor(code: TodoErrorCode, message: string) {
    super(code, message);
    this.code = code;
  }

  static notFound(): TodoError {
    return new TodoError('TODO_NOT_FOUND', 'Todo tidak ditemukan.');
  }

  /**
   * Dipakai ketika user bukan member workspace atau workspace sudah diarsipkan.
   * Pesannya sengaja sama dengan not found untuk mencegah enumerasi workspace.
   */
  static workspaceAccessDenied(): TodoError {
    return new TodoError('WORKSPACE_ACCESS_DENIED', 'Workspace tidak ditemukan.');
  }

  /**
   * Dipakai ketika user adalah member workspace tetapi role-nya tidak memiliki
   * izin untuk aksi tersebut (mis. MEMBER mencoba membuat Tag).
   */
  static permissionDenied(): TodoError {
    return new TodoError(
      'WORKSPACE_PERMISSION_DENIED',
      'Role Anda tidak memiliki izin untuk melakukan operasi ini.'
    );
  }

  static titleRequired(): TodoError {
    return new TodoError('TODO_TITLE_REQUIRED', 'Judul todo wajib diisi.');
  }

  static titleTooLong(maxLength = 200): TodoError {
    return new TodoError('TODO_TITLE_TOO_LONG', `Judul todo maksimal ${maxLength} karakter.`);
  }

  static descriptionTooLong(maxLength = 5000): TodoError {
    return new TodoError('TODO_DESCRIPTION_TOO_LONG', `Deskripsi todo maksimal ${maxLength} karakter.`);
  }

  static invalidStatus(): TodoError {
    return new TodoError('TODO_STATUS_INVALID', 'Status todo tidak valid.');
  }

  static invalidPriority(): TodoError {
    return new TodoError('TODO_PRIORITY_INVALID', 'Prioritas todo tidak valid.');
  }

  static invalidDueDate(message = 'Tanggal jatuh tempo harus berupa ISO 8601 dengan timezone eksplisit.'): TodoError {
    return new TodoError('TODO_DUE_DATE_INVALID', message);
  }

  static invalidCursor(): TodoError {
    return new TodoError('INVALID_CURSOR', 'Cursor tidak valid atau sudah tidak sesuai dengan filter.');
  }

  static invalidDateRange(message = 'Rentang tanggal tidak valid.'): TodoError {
    return new TodoError('INVALID_DATE_RANGE', message);
  }

  static invalidTimezone(): TodoError {
    return new TodoError('INVALID_TIMEZONE', 'Timezone harus berupa identifier IANA yang valid.');
  }

  static invalidUpcomingRange(message = 'Parameter days harus berada pada rentang 1 sampai 30.'): TodoError {
    return new TodoError('INVALID_UPCOMING_RANGE', message);
  }

  static validationError(message: string): TodoError {
    return new TodoError('VALIDATION_ERROR', message);
  }

  // ---------------------------------------------------------------------------
  // Tag
  // ---------------------------------------------------------------------------

  static tagNotFound(): TodoError {
    return new TodoError('TAG_NOT_FOUND', 'Tag tidak ditemukan.');
  }

  static tagNameRequired(): TodoError {
    return new TodoError('TAG_NAME_REQUIRED', 'Nama tag wajib diisi.');
  }

  static tagNameInvalid(message = 'Nama tag tidak valid.'): TodoError {
    return new TodoError('TAG_NAME_INVALID', message);
  }

  static tagNameTooLong(maxLength = 50): TodoError {
    return new TodoError('TAG_NAME_TOO_LONG', `Nama tag maksimal ${maxLength} karakter.`);
  }

  static tagAlreadyExists(): TodoError {
    return new TodoError('TAG_ALREADY_EXISTS', 'Tag dengan nama tersebut sudah ada di workspace ini.');
  }

  static tagWorkspaceMismatch(): TodoError {
    return new TodoError('TAG_WORKSPACE_MISMATCH', 'Tag tidak ditemukan pada workspace ini.');
  }

  static tagLimitExceeded(max = 20): TodoError {
    return new TodoError('TAG_LIMIT_EXCEEDED', `Satu todo maksimal memiliki ${max} tag.`);
  }

  static tagAssignmentInvalid(message = 'Daftar tag tidak valid.'): TodoError {
    return new TodoError('TAG_ASSIGNMENT_INVALID', message);
  }

  static todoTagAssignmentInvalid(message = 'Tag tidak dapat dipasang pada todo ini.'): TodoError {
    return new TodoError('TODO_TAG_ASSIGNMENT_INVALID', message);
  }

  // ---------------------------------------------------------------------------
  // Label
  // ---------------------------------------------------------------------------

  static labelNotFound(): TodoError {
    return new TodoError('LABEL_NOT_FOUND', 'Label tidak ditemukan.');
  }

  static labelNameRequired(): TodoError {
    return new TodoError('LABEL_NAME_REQUIRED', 'Nama label wajib diisi.');
  }

  static labelNameInvalid(message = 'Nama label tidak valid.'): TodoError {
    return new TodoError('LABEL_NAME_INVALID', message);
  }

  static labelNameTooLong(maxLength = 50): TodoError {
    return new TodoError('LABEL_NAME_TOO_LONG', `Nama label maksimal ${maxLength} karakter.`);
  }

  static labelAlreadyExists(): TodoError {
    return new TodoError('LABEL_ALREADY_EXISTS', 'Label dengan nama tersebut sudah ada di workspace ini.');
  }

  static labelColorInvalid(): TodoError {
    return new TodoError('LABEL_COLOR_INVALID', 'Warna label harus memakai format HEX #RRGGBB.');
  }

  static labelDescriptionTooLong(maxLength = 300): TodoError {
    return new TodoError('LABEL_DESCRIPTION_TOO_LONG', `Deskripsi label maksimal ${maxLength} karakter.`);
  }

  static labelWorkspaceMismatch(): TodoError {
    return new TodoError('LABEL_WORKSPACE_MISMATCH', 'Label tidak ditemukan pada workspace ini.');
  }

  static todoLabelAssignmentInvalid(message = 'Label tidak dapat dipasang pada todo ini.'): TodoError {
    return new TodoError('TODO_LABEL_ASSIGNMENT_INVALID', message);
  }

  // ---------------------------------------------------------------------------
  // Reminder
  // ---------------------------------------------------------------------------

  static reminderNotFound(): TodoError {
    return new TodoError('REMINDER_NOT_FOUND', 'Reminder tidak ditemukan.');
  }

  static reminderWorkspaceMismatch(): TodoError {
    return new TodoError('REMINDER_WORKSPACE_MISMATCH', 'Reminder tidak ditemukan pada workspace ini.');
  }

  static reminderTriggerTypeInvalid(): TodoError {
    return new TodoError(
      'REMINDER_TRIGGER_TYPE_INVALID',
      'triggerType harus bernilai absolute atau before_due.'
    );
  }

  static reminderTimeInvalid(message = 'Data waktu reminder tidak valid.'): TodoError {
    return new TodoError('REMINDER_TIME_INVALID', message);
  }

  static reminderTimeInPast(): TodoError {
    return new TodoError('REMINDER_TIME_IN_PAST', 'Waktu reminder harus berada di masa depan.');
  }

  static reminderOffsetInvalid(): TodoError {
    return new TodoError('REMINDER_OFFSET_INVALID', 'offsetMinutes harus bilangan bulat antara 1 dan 43200.');
  }

  static reminderAlreadyCancelled(): TodoError {
    return new TodoError('REMINDER_ALREADY_CANCELLED', 'Reminder sudah dibatalkan dan tidak dapat diubah.');
  }

  static reminderDuplicate(): TodoError {
    return new TodoError('REMINDER_DUPLICATE', 'Jadwal reminder yang sama sudah ada untuk todo ini.');
  }

  static reminderTodoIneligible(): TodoError {
    return new TodoError(
      'REMINDER_TODO_INELIGIBLE',
      'Reminder hanya dapat dibuat untuk todo yang aktif (tidak completed/cancelled/deleted).'
    );
  }

  static reminderDueDateRequired(): TodoError {
    return new TodoError(
      'REMINDER_DUE_DATE_REQUIRED',
      'Reminder before_due membutuhkan dueAt pada todo.'
    );
  }

  static reminderScheduleConflict(message = 'Perubahan jadwal reminder bertentangan dengan dueAt todo.'): TodoError {
    return new TodoError('REMINDER_SCHEDULE_CONFLICT', message);
  }

  static todoHasRelativeReminders(): TodoError {
    return new TodoError(
      'TODO_HAS_RELATIVE_REMINDERS',
      'dueAt tidak dapat dikosongkan selama masih ada reminder before_due yang scheduled.'
    );
  }

  static todoDueDateConflictsWithReminders(): TodoError {
    return new TodoError(
      'TODO_DUE_DATE_CONFLICTS_WITH_REMINDERS',
      'Perubahan dueAt membuat waktu efektif reminder before_due berada di masa lalu.'
    );
  }
}
