import { describe, expect, test } from 'vitest';
import { mapTodoValidationDetails } from './api-validation';

describe('mapTodoValidationDetails', () => {
  test('memetakan path body dan nested ke field Todo', () => {
    expect(
      mapTodoValidationDetails(
        [
          { path: 'body.title', message: 'Judul ditolak.' },
          { path: 'description', message: 'Deskripsi terlalu panjang.' }
        ],
        ['title', 'description']
      )
    ).toEqual({
      title: 'Judul ditolak.',
      description: 'Deskripsi terlalu panjang.'
    });
  });

  test('mengabaikan detail yang tidak relevan dan mempertahankan pesan pertama', () => {
    expect(
      mapTodoValidationDetails(
        [
          { path: 'body.priority', message: 'Prioritas tidak valid.' },
          { path: 'body.title', message: 'Pesan pertama.' },
          { path: 'body.title', message: 'Pesan kedua.' }
        ],
        ['title', 'description']
      )
    ).toEqual({ title: 'Pesan pertama.' });
  });
});
