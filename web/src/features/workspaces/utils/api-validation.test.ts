import { describe, expect, test } from 'vitest';
import { mapValidationDetails } from './api-validation';

describe('mapValidationDetails', () => {
  test('memetakan path bersarang ke nama field form', () => {
    const result = mapValidationDetails(
      [
        { path: 'body.name', message: 'Nama terlalu panjang.' },
        { path: 'body.description', message: 'Deskripsi terlalu panjang.' }
      ],
      ['name', 'description'] as const
    );

    expect(result).toEqual({
      name: 'Nama terlalu panjang.',
      description: 'Deskripsi terlalu panjang.'
    });
  });

  test('mengabaikan detail yang tidak relevan dengan form', () => {
    const result = mapValidationDetails([{ path: 'body.unknown', message: 'Tidak dipakai.' }], [
      'name',
      'description'
    ] as const);

    expect(result).toEqual({});
  });

  test('mempertahankan pesan pertama untuk field yang sama', () => {
    const result = mapValidationDetails(
      [
        { path: 'body.name', message: 'Pesan pertama.' },
        { path: 'name', message: 'Pesan kedua.' }
      ],
      ['name'] as const
    );

    expect(result).toEqual({ name: 'Pesan pertama.' });
  });
});
