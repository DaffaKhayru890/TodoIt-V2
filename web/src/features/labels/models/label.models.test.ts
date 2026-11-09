import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { labelFixtures, makeLabelDto } from '@/test/fixtures/labels';
import { assertLabelListResponseDto, assertLabelResponseDto } from './label.guard';
import {
  getLabelTextColor,
  toCreateLabelRequestDto,
  toLabel,
  toLabelListResult,
  toUpdateLabelRequestDto
} from './label.mapper';

describe('label.guard', () => {
  test('menerima response label dan daftar label yang valid', () => {
    expect(() => assertLabelResponseDto({ label: makeLabelDto() })).not.toThrow();
    expect(() =>
      assertLabelListResponseDto({
        items: labelFixtures,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    ).not.toThrow();
  });

  test('menolak bentuk response label yang rusak', () => {
    expect(() => assertLabelResponseDto({ label: { id: 'rusak' } })).toThrow(ApiError);
    expect(() => assertLabelResponseDto(null)).toThrow(ApiError);
    expect(() =>
      assertLabelListResponseDto({
        items: [{ ...makeLabelDto(), description: 1 }],
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    ).toThrow(ApiError);
    expect(() =>
      assertLabelListResponseDto({
        items: [],
        pagination: { limit: 100, hasMore: false, nextCursor: 1 }
      })
    ).toThrow(ApiError);
  });

  test('kode error konsisten INVALID_LABEL_RESPONSE', () => {
    try {
      assertLabelResponseDto({ label: {} });
      expect.unreachable('Seharusnya melempar error');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_LABEL_RESPONSE' });
    }
  });
});

describe('label.mapper', () => {
  test('toLabel memetakan seluruh field termasuk description null', () => {
    const label = toLabel(makeLabelDto({ description: null }));

    expect(label.color).toBe('#E74C3C');
    expect(label.description).toBeNull();
    expect(label.createdAt).toBeInstanceOf(Date);
  });

  test('toLabel menolak tanggal rusak', () => {
    expect(() => toLabel(makeLabelDto({ createdAt: 'rusak' }))).toThrow(ApiError);
  });

  test('toLabelListResult mempertahankan pagination', () => {
    const result = toLabelListResult({
      items: labelFixtures,
      pagination: { limit: 100, hasMore: true, nextCursor: 'cursor-1' }
    });

    expect(result.items).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
  });

  test('toCreateLabelRequestDto menormalkan nama, warna uppercase, dan deskripsi', () => {
    expect(
      toCreateLabelRequestDto({
        name: '  Bug  ',
        color: '#e74c3c',
        description: '  Masalah produksi  '
      })
    ).toEqual({ name: 'Bug', color: '#E74C3C', description: 'Masalah produksi' });

    expect(
      toCreateLabelRequestDto({ name: 'Bug', color: '#E74C3C', description: '   ' })
    ).toEqual({ name: 'Bug', color: '#E74C3C', description: null });

    expect(
      toCreateLabelRequestDto({ name: 'Bug', color: '#E74C3C', description: null })
    ).toEqual({ name: 'Bug', color: '#E74C3C' });
  });

  test('toUpdateLabelRequestDto hanya mengirim field yang didefinisikan', () => {
    expect(toUpdateLabelRequestDto({})).toEqual({});
    expect(toUpdateLabelRequestDto({ name: '  Feature  ' })).toEqual({ name: 'Feature' });
    expect(toUpdateLabelRequestDto({ color: '#27ae60' })).toEqual({ color: '#27AE60' });
    expect(toUpdateLabelRequestDto({ description: null })).toEqual({ description: null });
    expect(toUpdateLabelRequestDto({ description: '  Baru  ' })).toEqual({
      description: 'Baru'
    });
    expect(toUpdateLabelRequestDto({ description: '   ' })).toEqual({ description: null });
  });

  test('getLabelTextColor memilih hitam atau putih berdasarkan luminance', () => {
    expect(getLabelTextColor('#FFFFFF')).toBe('#000000');
    expect(getLabelTextColor('#F39C12')).toBe('#000000');
    expect(getLabelTextColor('#000000')).toBe('#FFFFFF');
    expect(getLabelTextColor('#34495E')).toBe('#FFFFFF');
  });

  test('getLabelTextColor kembali ke hitam untuk warna tidak valid', () => {
    expect(getLabelTextColor('merah')).toBe('#000000');
    expect(getLabelTextColor('#FFF')).toBe('#000000');
  });
});
