import { TodoError } from '../errors/todo-error';

/** Format warna yang diterima: tepat #RRGGBB (hex 6 digit). */
export const LABEL_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Warna disimpan dalam bentuk kanonik uppercase supaya nilai yang sama tidak
 * dianggap berbeda hanya karena kapitalisasi. Parsing dilakukan oleh regex;
 * tidak ada konversi model warna lain pada fase ini.
 */
export function normalizeLabelColor(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw TodoError.labelColorInvalid();
  }

  const color = raw.trim();

  if (!LABEL_COLOR_PATTERN.test(color)) {
    throw TodoError.labelColorInvalid();
  }

  return color.toUpperCase();
}
