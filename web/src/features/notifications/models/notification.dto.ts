export interface NotificationDto {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly data: Record<string, unknown>;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationPaginationDto {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface NotificationListResponseDto {
  readonly items: readonly NotificationDto[];
  readonly pagination: NotificationPaginationDto;
}

export interface UnreadCountResponseDto {
  readonly unreadCount: number;
}

export interface NotificationResponseDto {
  readonly notification: NotificationDto;
}

export interface MarkAllReadResponseDto {
  readonly updated: number;
}

export interface NotificationPreferencesResponseDto {
  readonly preferences: {
    readonly inAppEnabled: true;
    readonly emailEnabled: boolean;
  };
}
