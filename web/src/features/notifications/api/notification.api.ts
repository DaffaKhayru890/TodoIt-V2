import { httpClient, type HttpClient } from '@/core/api/http-client';
import {
  assertMarkAllReadResponseDto,
  assertNotificationListResponseDto,
  assertNotificationPreferencesResponseDto,
  assertNotificationResponseDto,
  assertUnreadCountResponseDto
} from '../models/notification.guard';
import {
  toNotificationListResult,
  toAppNotification
} from '../models/notification.mapper';
import { toNotificationPreferences } from '../models/notification.guard';
import type {
  ListNotificationsParams,
  NotificationListResult,
  NotificationPreferences
} from '../models/notification.model';

export interface NotificationRequestOptions {
  readonly signal?: AbortSignal;
}

export interface NotificationApiService {
  getList(
    params?: ListNotificationsParams,
    options?: NotificationRequestOptions
  ): Promise<NotificationListResult>;
  getUnreadCount(options?: NotificationRequestOptions): Promise<number>;
  markRead(
    notificationId: string,
    options?: NotificationRequestOptions
  ): Promise<NotificationListResult['items'][number]>;
  markAllRead(options?: NotificationRequestOptions): Promise<number>;
  getPreferences(options?: NotificationRequestOptions): Promise<NotificationPreferences>;
  updatePreferences(
    input: { emailEnabled: boolean },
    options?: NotificationRequestOptions
  ): Promise<NotificationPreferences>;
}

const NOTIFICATIONS_PATH = '/api/v1/notifications';

function buildListPath(params?: ListNotificationsParams): string {
  const searchParams = new URLSearchParams();

  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.cursor !== undefined) searchParams.set('cursor', params.cursor);
  if (params?.readStatus !== undefined && params.readStatus !== 'all') {
    searchParams.set('readStatus', params.readStatus);
  }
  if (params?.type !== undefined) searchParams.set('type', params.type);

  const query = searchParams.toString();
  return query ? `${NOTIFICATIONS_PATH}?${query}` : NOTIFICATIONS_PATH;
}

function requestOptions(
  method: 'GET' | 'PATCH' | 'POST',
  options?: NotificationRequestOptions
): { method: 'GET' | 'PATCH' | 'POST'; signal?: AbortSignal } {
  return options?.signal ? { method, signal: options.signal } : { method };
}

export function createNotificationApi(client: HttpClient = httpClient): NotificationApiService {
  return {
    async getList(params, options) {
      const response = await client.request<unknown>(
        buildListPath(params),
        requestOptions('GET', options)
      );

      assertNotificationListResponseDto(response);
      return toNotificationListResult(response);
    },

    async getUnreadCount(options) {
      const response = await client.request<unknown>(
        `${NOTIFICATIONS_PATH}/unread-count`,
        requestOptions('GET', options)
      );

      assertUnreadCountResponseDto(response);
      return response.unreadCount;
    },

    async markRead(notificationId, options) {
      const response = await client.request<unknown>(
        `${NOTIFICATIONS_PATH}/${encodeURIComponent(notificationId)}/read`,
        requestOptions('PATCH', options)
      );

      assertNotificationResponseDto(response);
      return toAppNotification(response.notification);
    },

    async markAllRead(options) {
      const response = await client.request<unknown>(
        `${NOTIFICATIONS_PATH}/read-all`,
        requestOptions('PATCH', options)
      );

      assertMarkAllReadResponseDto(response);
      return response.updated;
    },

    async getPreferences(options) {
      const response = await client.request<unknown>(
        `${NOTIFICATIONS_PATH}/preferences`,
        requestOptions('GET', options)
      );

      assertNotificationPreferencesResponseDto(response);
      return toNotificationPreferences(response);
    },

    async updatePreferences(input, options) {
      const response = await client.request<unknown>(
        `${NOTIFICATIONS_PATH}/preferences`,
        {
          ...requestOptions('PATCH', options),
          body: { emailEnabled: input.emailEnabled }
        }
      );

      assertNotificationPreferencesResponseDto(response);
      return toNotificationPreferences(response);
    }
  };
}

export const notificationApi = createNotificationApi();
