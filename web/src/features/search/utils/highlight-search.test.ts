import { describe, expect, test } from 'vitest';
import { splitHighlight } from './highlight-search';

describe('splitHighlight', () => {
  test('memecah teks menjadi bagian match dan non-match secara case-insensitive', () => {
    const parts = splitHighlight('Complete Backend integration', 'backend');

    expect(parts).toEqual([
      { text: 'Complete ', match: false },
      { text: 'Backend', match: true },
      { text: ' integration', match: false }
    ]);
  });

  test('menemukan seluruh kemunculan', () => {
    const matches = splitHighlight('todo TODO Todo', 'todo').filter((part) => part.match);

    expect(matches.map((part) => part.text)).toEqual(['todo', 'TODO', 'Todo']);
  });

  test('teks asli tidak berubah ketika digabung kembali', () => {
    const text = 'Backend & <frontend> 100%';
    const parts = splitHighlight(text, 'frontend');

    expect(parts.map((part) => part.text).join('')).toBe(text);
  });

  test('karakter khusus regex diperlakukan literal', () => {
    const parts = splitHighlight('Nilai 100% dan a.b', 'a.b');

    expect(parts.some((part) => part.match && part.text === 'a.b')).toBe(true);
    expect(parts.some((part) => part.match && part.text === 'aXb')).toBe(false);
  });

  test('query kosong mengembalikan satu bagian biasa', () => {
    expect(splitHighlight('Backend', '   ')).toEqual([{ text: 'Backend', match: false }]);
  });

  test('teks kosong ditangani tanpa error', () => {
    expect(splitHighlight('', 'backend')).toEqual([{ text: '', match: false }]);
  });
});
