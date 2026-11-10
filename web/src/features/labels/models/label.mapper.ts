import { ApiError } from '@/core/errors/api-error';
import type {
  CreateLabelRequestDto,
  LabelDto,
  ListLabelsResponseDto,
  UpdateLabelRequestDto
} from './label.dto';
import type { CreateLabelInput, Label, LabelListResult, UpdateLabelInput } from './label.model';

function parseDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError('Tanggal label dari server tidak valid.', 0, 'INVALID_LABEL_RESPONSE');
  }

  return date;
}

export function toLabel(dto: LabelDto): Label {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    name: dto.name,
    color: dto.color,
    description: dto.description ?? null,
    createdAt: parseDate(dto.createdAt),
    updatedAt: parseDate(dto.updatedAt)
  };
}

export function toLabelListResult(dto: ListLabelsResponseDto): LabelListResult {
  return {
    items: dto.items.map(toLabel),
    pagination: {
      limit: dto.pagination.limit,
      hasMore: dto.pagination.hasMore,
      nextCursor: dto.pagination.nextCursor
    }
  };
}

export function toCreateLabelRequestDto(input: CreateLabelInput): CreateLabelRequestDto {
  return {
    name: input.name.trim(),
    color: input.color.toUpperCase(),
    ...(input.description !== null ? { description: input.description.trim() || null } : {})
  };
}

export function toUpdateLabelRequestDto(input: UpdateLabelInput): UpdateLabelRequestDto {
  const result: { name?: string; color?: string; description?: string | null } = {};

  if (input.name !== undefined) result.name = input.name.trim();
  if (input.color !== undefined) result.color = input.color.toUpperCase();
  if (input.description !== undefined) {
    result.description = input.description === null ? null : input.description.trim() || null;
  }

  return result;
}

/**
 * Warna label berasal dari backend. Teks memakai hitam/putih berdasarkan
 * luminance agar tetap terbaca; warna bukan satu-satunya pembeda karena nama
 * label selalu ditampilkan.
 */
export function getLabelTextColor(hexColor: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hexColor);

  if (!match) {
    return '#000000';
  }

  const value = match[1]!;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}
