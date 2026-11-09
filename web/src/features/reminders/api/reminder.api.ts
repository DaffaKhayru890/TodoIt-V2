import { httpClient, type HttpClient } from '@/core/api/http-client';
import {
  assertReminderListResponseDto,
  assertReminderResponseDto
} from '../models/reminder.guard';
import {
  toCreateReminderRequestDto,
  toReminder,
  toReminderListResult,
  toUpdateReminderRequestDto
} from '../models/reminder.mapper';
import type {
  CreateReminderInput,
  ListRemindersParams,
  Reminder,
  ReminderListResult,
  UpdateReminderInput
} from '../models/reminder.model';

export const REMINDER_LIST_PAGE_SIZE = 100;

export interface ReminderApiService {
  list(
    workspaceId: string,
    todoId: string,
    params?: ListRemindersParams
  ): Promise<ReminderListResult>;
  get(workspaceId: string, todoId: string, reminderId: string): Promise<Reminder>;
  create(workspaceId: string, todoId: string, input: CreateReminderInput): Promise<Reminder>;
  update(
    workspaceId: string,
    todoId: string,
    reminderId: string,
    input: UpdateReminderInput
  ): Promise<Reminder>;
  cancel(workspaceId: string, todoId: string, reminderId: string): Promise<void>;
}

function remindersPath(workspaceId: string, todoId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/todos/${encodeURIComponent(todoId)}/reminders`;
}

function reminderPath(workspaceId: string, todoId: string, reminderId: string): string {
  return `${remindersPath(workspaceId, todoId)}/${encodeURIComponent(reminderId)}`;
}

function buildListPath(
  workspaceId: string,
  todoId: string,
  params?: ListRemindersParams
): string {
  const searchParams = new URLSearchParams();

  if (params?.status !== undefined) searchParams.set('status', params.status);
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.cursor !== undefined) searchParams.set('cursor', params.cursor);

  const query = searchParams.toString();
  const path = remindersPath(workspaceId, todoId);
  return query ? `${path}?${query}` : path;
}

export function createReminderApi(client: HttpClient = httpClient): ReminderApiService {
  return {
    async list(workspaceId, todoId, params) {
      const response = await client.request<unknown>(buildListPath(workspaceId, todoId, params), {
        method: 'GET'
      });

      assertReminderListResponseDto(response);
      return toReminderListResult(response);
    },

    async get(workspaceId, todoId, reminderId) {
      const response = await client.request<unknown>(
        reminderPath(workspaceId, todoId, reminderId),
        { method: 'GET' }
      );

      assertReminderResponseDto(response);
      return toReminder(response.reminder);
    },

    async create(workspaceId, todoId, input) {
      const response = await client.request<unknown>(remindersPath(workspaceId, todoId), {
        method: 'POST',
        body: toCreateReminderRequestDto(input)
      });

      assertReminderResponseDto(response);
      return toReminder(response.reminder);
    },

    async update(workspaceId, todoId, reminderId, input) {
      const response = await client.request<unknown>(
        reminderPath(workspaceId, todoId, reminderId),
        {
          method: 'PATCH',
          body: toUpdateReminderRequestDto(input)
        }
      );

      assertReminderResponseDto(response);
      return toReminder(response.reminder);
    },

    async cancel(workspaceId, todoId, reminderId) {
      await client.request<void>(reminderPath(workspaceId, todoId, reminderId), {
        method: 'DELETE'
      });
    }
  };
}

export const reminderApi = createReminderApi();
