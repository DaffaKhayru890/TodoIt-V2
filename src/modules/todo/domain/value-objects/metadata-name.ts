import { TodoError } from '../errors/todo-error';

export const METADATA_NAME_MAX_LENGTH = 50;

export interface NormalizedMetadataName {
  /** Nama yang ditampilkan, sudah di-trim namun case dipertahankan. */
  readonly name: string;
  /** Kunci unik case-insensitive; hanya trim + lowercase tanpa transliterasi. */
  readonly normalizedName: string;
}

export interface MetadataNameErrorFactory {
  readonly required: () => TodoError;
  readonly tooLong: (maxLength: number) => TodoError;
  readonly invalid: (message: string) => TodoError;
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

/**
 * Normalisasi nama Tag/Label.
 *
 * Aturan sengaja minimal: trim dan lowercase. Tidak ada transliterasi atau
 * penggantian karakter karena nama harus tetap dapat ditampilkan apa adanya.
 * Kontrol karakter ditolak agar nama tidak merusak representasi teks/HTTP.
 */
export function normalizeMetadataName(
  raw: unknown,
  errors: MetadataNameErrorFactory
): NormalizedMetadataName {
  if (typeof raw !== 'string') {
    throw errors.invalid('Nama harus berupa string.');
  }

  if (CONTROL_CHARACTER_PATTERN.test(raw)) {
    throw errors.invalid('Nama tidak boleh memuat karakter kontrol.');
  }

  const name = raw.trim();

  if (name.length === 0) {
    throw errors.required();
  }

  if (name.length > METADATA_NAME_MAX_LENGTH) {
    throw errors.tooLong(METADATA_NAME_MAX_LENGTH);
  }

  return {
    name,
    normalizedName: name.toLowerCase()
  };
}
