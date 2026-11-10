import { normalizeSearchQuery } from '../models/search.model';

export interface HighlightPart {
  readonly text: string;
  readonly match: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Memecah teks menjadi bagian biasa dan bagian yang cocok dengan query.
 *
 * Menggunakan `String.split` dengan capturing group, bukan HTML injection,
 * sehingga teks asli tetap utuh dan aman. Pencocokan mengikuti perilaku
 * backend: case-insensitive dan wildcard diperlakukan literal.
 */
export function splitHighlight(text: string, query: string): readonly HighlightPart[] {
  const needle = normalizeSearchQuery(query);

  if (!needle || !text) {
    return [{ text, match: false }];
  }

  const pattern = new RegExp(`(${escapeRegExp(needle)})`, 'gi');
  const pieces = text.split(pattern);

  return pieces
    .filter((piece) => piece.length > 0)
    .map((piece, index) => ({ text: piece, match: index % 2 === 1 }));
}
