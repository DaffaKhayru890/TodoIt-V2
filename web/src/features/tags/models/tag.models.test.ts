import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeTagDto, tagFixtures } from '@/test/fixtures/tags';
import {
  assertTagListResponseDto,
  assertTagResponseDto,
  assertTodoTagsResponseDto
} from './tag.guard';
import {
  toCreateTagRequestDto,
  toTag,
  toTagListResult,
  toTodoTagSummaries,
  toUpdateTagRequestDto
} from './tag.mapper';

describe('tag.guard', () => {
  test('menerima response tag dan daftar tag yang valid', () => {
    expect(() => assertTagResponseDto({ tag: makeTagDto() })).not.toThrow();
    expect(() =>
      assertTagListResponseDto({
        items: tagFixtures,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    ).not.toThrow();
    expect(() =>
      assertTodoTagsResponseDto({ tags: [{ id: 'tag-1', name: 'backend' }] })
    ).not.toThrow();
  });

  test('menolak bentuk response tag yang rusak', () => {
    expect(() => assertTagResponseDto({ tag: { id: 'rusak' } })).toThrow(ApiError);
    expect(() => assertTagResponseDto(null)).toThrow(ApiError);
    expect(() =>
      assertTagListResponseDto({
        items: [{ ...makeTagDto(), createdAt: 'bukan-tanggal' }],
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    ).toThrow(ApiError);
    expect(() =>
      assertTagListResponseDto({
        items: [],
        pagination: { limit: '100', hasMore: false, nextCursor: null }
      })
    ).toThrow(ApiError);
    expect(() => assertTodoTagsResponseDto({ tags: [{ id: 1 }] })).toThrow(ApiError);
  });

  test('kode error konsisten INVALID_TAG_RESPONSE', () => {
    try {
      assertTagResponseDto({ tag: {} });
      expect.unreachable('Seharusnya melempar error');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_TAG_RESPONSE' });
    }
  });
});

describe('tag.mapper', () => {
  test('toTag memetakan tanggal ke Date', () => {
    const tag = toTag(makeTagDto());

    expect(tag.id).toBe('a1111111-1111-4111-8111-111111111111');
    expect(tag.name).toBe('backend');
    expect(tag.createdAt).toBeInstanceOf(Date);
    expect(tag.updatedAt).toBeInstanceOf(Date);
  });

  test('toTag menolak tanggal rusak', () => {
    expect(() => toTag(makeTagDto({ updatedAt: 'rusak' }))).toThrow(ApiError);
  });

  test('toTagListResult mempertahankan pagination', () => {
    const result = toTagListResult({
      items: tagFixtures,
      pagination: { limit: 100, hasMore: true, nextCursor: 'cursor-1' }
    });

    expect(result.items).toHaveLength(2);
    expect(result.pagination).toEqual({ limit: 100, hasMore: true, nextCursor: 'cursor-1' });
  });

  test('toTodoTagSummaries hanya mempertahankan id dan name', () => {
    expect(
      toTodoTagSummaries({ tags: [{ id: 'tag-1', name: 'backend' }] })
    ).toEqual([{ id: 'tag-1', name: 'backend' }]);
  });

  test('request DTO melakukan trim nama', () => {
    expect(toCreateTagRequestDto({ name: '  Backend  ' })).toEqual({ name: 'Backend' });
    expect(toUpdateTagRequestDto({ name: '  Design  ' })).toEqual({ name: 'Design' });
  });
});
