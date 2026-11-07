export type SecurityEventContext = Readonly<Record<string, string | number>>;

/**
 * Pencatatan event keamanan dari use case (mis. token reuse). Port ini ada supaya
 * application layer tidak mengimpor logger infrastructure; implementasinya hanya
 * meneruskan ke logger terstruktur.
 *
 * Konteks yang diizinkan adalah identifier yang sudah di-hash atau berupa ID
 * internal. Password, token, dan secret tidak boleh dilewatkan ke sini.
 */
export interface SecurityLog {
  warn(event: string, context: SecurityEventContext): void;
}
