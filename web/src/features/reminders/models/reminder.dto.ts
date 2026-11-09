export interface ReminderDto {
  readonly id: string;
  readonly todoId: string;
  readonly triggerType: string;
  readonly remindAt: string | null;
  readonly offsetMinutes: number | null;
  readonly effectiveAt: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancelledAt: string | null;
}

export interface ReminderPaginationDto {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface ListRemindersResponseDto {
  readonly items: readonly ReminderDto[];
  readonly pagination: ReminderPaginationDto;
}

export interface ReminderResponseDto {
  readonly reminder: ReminderDto;
}

export interface CreateReminderRequestDto {
  readonly triggerType: string;
  readonly remindAt?: string | null;
  readonly offsetMinutes?: number | null;
}

export interface UpdateReminderRequestDto {
  readonly remindAt?: string;
  readonly offsetMinutes?: number;
}
