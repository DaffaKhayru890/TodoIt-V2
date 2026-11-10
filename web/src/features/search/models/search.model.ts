/**
 * Model pencarian global.
 *
 * Backend tidak memiliki endpoint pencarian global. Pencarian dijalankan
 * dengan fan-out ke endpoint per workspace yang memang mendukung `q`:
 * todo, tag, dan label. Karena itu model ini hanya memiliki tiga kategori.
 * Workspace sendiri tidak dapat dicari melalui API (tidak ada parameter `q`
 * pada `GET /workspaces`), sehingga kategori tersebut sengaja tidak dibuat.
 */
export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_QUERY_LENGTH = 200;
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_RECENT_LIMIT = 8;
export const SEARCH_RECENT_STORAGE_KEY = 'todoit.search.recent.v1';

export const SEARCH_RESULT_KINDS = ['todo', 'tag', 'label'] as const;

export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];

export interface SearchWorkspace {
  readonly id: string;
  readonly name: string;
}

export interface SearchResultItem {
  readonly id: string;
  readonly kind: SearchResultKind;
  readonly title: string;
  readonly description: string | null;
  readonly meta: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly href: string;
}

export interface SearchResultGroup {
  readonly kind: SearchResultKind;
  readonly label: string;
  readonly items: readonly SearchResultItem[];
}

export interface GlobalSearchResult {
  readonly query: string;
  readonly groups: readonly SearchResultGroup[];
  readonly total: number;
  /** Jumlah workspace yang gagal dicari; hasil workspace lain tetap ditampilkan. */
  readonly failedWorkspaces: number;
}

export interface SearchRequest {
  readonly query: string;
  readonly workspaces: readonly SearchWorkspace[];
  readonly signal?: AbortSignal;
}

export interface RecentSearchStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Menormalkan query agar recent search tidak menyimpan variasi spasi/duplikat. */
export function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
}

export function isSearchableQuery(value: string): boolean {
  return normalizeSearchQuery(value).length >= SEARCH_MIN_QUERY_LENGTH;
}

export function isSearchResultKind(value: string): value is SearchResultKind {
  return (SEARCH_RESULT_KINDS as readonly string[]).includes(value);
}
