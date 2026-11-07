/**
 * Deklarasi seluruh environment variable yang dikenal aplikasi beserta aturan
 * parsing-nya. File ini satu-satunya tempat aturan bentuk (tipe/default/wajib)
 * didefinisikan; `env.ts` yang membacanya dan `app-config.ts` yang merakitnya
 * menjadi konfigurasi bertipe.
 */

export const NODE_ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const COOKIE_SAME_SITE_VALUES = ['lax', 'strict', 'none'] as const;
export type CookieSameSite = (typeof COOKIE_SAME_SITE_VALUES)[number];

/** Nilai mentah seperti yang ditemukan pada process.env. */
export type RawEnvValue = string | undefined;

/** Nilai hasil parsing yang siap dikonsumsi app-config. */
export type ParsedEnvValue = string | number | boolean | readonly string[];

/**
 * Satu rule punya dua bentuk: wajib (tanpa default) atau opsional (wajib
 * menuliskan default). Dengan begini tidak ada jalur parsing yang harus menebak
 * nilai default yang tidak dideklarasikan.
 */
type DefaultValueByKind = {
  string: string;
  enum: string;
  integer: number;
  port: number;
  boolean: boolean;
  csv: readonly string[];
};

type Rule<K extends keyof DefaultValueByKind, Extra> =
  | ({ kind: K; required: true } & Extra)
  | ({ kind: K; required: false; defaultValue: DefaultValueByKind[K] } & Extra);

type StringRule = Rule<'string', { secret?: boolean; minLength?: number }>;
type EnumRule = Rule<'enum', { allowedValues: readonly string[]; secret?: boolean }>;
type IntegerRule = Rule<'integer', { min?: number; max?: number }>;
type PortRule = Rule<'port', Record<never, never>>;
type BooleanRule = Rule<'boolean', Record<never, never>>;
type CsvRule = Rule<'csv', Record<never, never>>;

export type EnvFieldRule = StringRule | EnumRule | IntegerRule | PortRule | BooleanRule | CsvRule;

const BOOLEAN_TRUE = new Set(['1', 'true', 'yes', 'on']);
const BOOLEAN_FALSE = new Set(['0', 'false', 'no', 'off']);
const PORT_MIN = 1;
const PORT_MAX = 65_535;

/**
 * Aturan parsing yang mengembalikan error (bukan exception) supaya seluruh
 * masalah konfigurasi dapat dilaporkan sekaligus saat startup.
 */
export function parseEnvField(
  name: string,
  rule: EnvFieldRule,
  rawValue: RawEnvValue
): { value: ParsedEnvValue } | { error: string } {
  const trimmed = rawValue?.trim();

  if (trimmed === undefined || trimmed === '') {
    if (rule.required) {
      return { error: `${name} wajib diisi dan tidak boleh kosong` };
    }

    return { value: rule.defaultValue };
  }

  switch (rule.kind) {
    case 'string':
      if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
        return {
          error: `${name} harus minimal ${rule.minLength} karakter (ditemukan: ${trimmed.length} karakter). Gunakan generator secret yang benar, jangan nilai placeholder.`
        };
      }

      return { value: trimmed };

    case 'enum':
      if (!rule.allowedValues.includes(trimmed)) {
        return {
          error: `${name} harus salah satu dari: ${rule.allowedValues.join(', ')} (ditemukan: "${trimmed}")`
        };
      }

      return { value: trimmed };

    case 'integer': {
      const parsed = Number(trimmed);

      if (!Number.isInteger(parsed)) {
        return { error: `${name} harus bilangan bulat (ditemukan: "${trimmed}")` };
      }

      if (rule.min !== undefined && parsed < rule.min) {
        return { error: `${name} tidak boleh kurang dari ${rule.min} (ditemukan: ${parsed})` };
      }

      if (rule.max !== undefined && parsed > rule.max) {
        return { error: `${name} tidak boleh lebih dari ${rule.max} (ditemukan: ${parsed})` };
      }

      return { value: parsed };
    }

    case 'port': {
      const port = Number(trimmed);

      if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) {
        return { error: `${name} harus integer dalam rentang ${PORT_MIN}-${PORT_MAX} (ditemukan: "${trimmed}")` };
      }

      return { value: port };
    }

    case 'boolean': {
      const normalized = trimmed.toLowerCase();

      if (BOOLEAN_TRUE.has(normalized)) {
        return { value: true };
      }

      if (BOOLEAN_FALSE.has(normalized)) {
        return { value: false };
      }

      return { error: `${name} harus bernilai true/false (ditemukan: "${trimmed}")` };
    }

    case 'csv': {
      const entries = trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      if (entries.length > 0) {
        return { value: entries };
      }

      if (rule.required) {
        return { error: `${name} harus memuat setidaknya satu nilai` };
      }

      return { value: rule.defaultValue };
    }
  }
}
