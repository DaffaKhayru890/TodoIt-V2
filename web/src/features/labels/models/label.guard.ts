import { ApiError } from '@/core/errors/api-error';
import type { LabelDto, LabelResponseDto, ListLabelsResponseDto } from './label.dto';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isLabelDto(value: unknown): value is LabelDto {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt)
  );
}

function invalidResponse(): never {
  throw new ApiError('Respons label dari server tidak valid.', 0, 'INVALID_LABEL_RESPONSE');
}

export function assertLabelResponseDto(value: unknown): asserts value is LabelResponseDto {
  if (!isObject(value) || !isLabelDto(value.label)) {
    invalidResponse();
  }
}

export function assertLabelListResponseDto(value: unknown): asserts value is ListLabelsResponseDto {
  if (!isObject(value) || !Array.isArray(value.items) || !value.items.every(isLabelDto)) {
    invalidResponse();
  }

  const pagination = value.pagination;

  if (
    !isObject(pagination) ||
    typeof pagination.limit !== 'number' ||
    typeof pagination.hasMore !== 'boolean' ||
    (pagination.nextCursor !== null && typeof pagination.nextCursor !== 'string')
  ) {
    invalidResponse();
  }
}
