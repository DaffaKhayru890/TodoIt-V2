/**
 * Kontrak error yang dikenali presentation layer untuk pemetaan HTTP.
 *
 * Domain module melempar turunan kelas ini dengan kode stabil; shared
 * presentation cukup mengenali kontrak ini tanpa mengimpor kelas error dari
 * masing-masing module, sehingga tidak ada arah dependency yang terbalik.
 */
export abstract class ApplicationError extends Error {
  readonly code: string;

  protected constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
