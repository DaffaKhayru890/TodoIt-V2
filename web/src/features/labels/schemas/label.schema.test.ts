import { describe, expect, test } from 'vitest';
import { LABEL_COLOR_PRESETS, labelColorSchema, labelFormSchema } from './label.schema';

describe('labelFormSchema', () => {
  test('menerima nilai valid dan melakukan trim', () => {
    const result = labelFormSchema.safeParse({
      name: '  Bug  ',
      color: '#e74c3c',
      description: '  Masalah produksi  '
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe('Bug');
    expect(result.success && result.data.description).toBe('Masalah produksi');
  });

  test('menolak nama kosong dan lebih dari 50 karakter', () => {
    expect(labelFormSchema.safeParse({ name: ' ', color: '#E74C3C' }).success).toBe(false);
    expect(labelFormSchema.safeParse({ name: 'a'.repeat(51), color: '#E74C3C' }).success).toBe(
      false
    );
  });

  test('menerima warna presets dan menolak format lain', () => {
    for (const color of LABEL_COLOR_PRESETS) {
      expect(labelColorSchema.safeParse(color).success).toBe(true);
    }

    expect(labelColorSchema.safeParse('merah').success).toBe(false);
    expect(labelColorSchema.safeParse('#FFF').success).toBe(false);
    expect(labelColorSchema.safeParse('#GGGGGG').success).toBe(false);
  });

  test('deskripsi maksimal 300 karakter dan boleh kosong', () => {
    expect(
      labelFormSchema.safeParse({ name: 'Bug', color: '#E74C3C', description: '' }).success
    ).toBe(true);
    expect(
      labelFormSchema.safeParse({
        name: 'Bug',
        color: '#E74C3C',
        description: 'a'.repeat(300)
      }).success
    ).toBe(true);
    expect(
      labelFormSchema.safeParse({
        name: 'Bug',
        color: '#E74C3C',
        description: 'a'.repeat(301)
      }).success
    ).toBe(false);
  });
});
