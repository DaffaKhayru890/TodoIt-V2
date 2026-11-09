import type { TodoPriority } from './todo.model';

export type PriorityBadgeVariant = 'neutral' | 'warning' | 'danger';

export interface PriorityConfig {
  /** Nilai API backend. */
  readonly value: TodoPriority;
  /** Label yang ditampilkan ke pengguna. */
  readonly label: string;
  /** Bobot untuk sorting; makin besar makin tinggi. */
  readonly sortWeight: number;
  readonly badgeVariant: PriorityBadgeVariant;
  readonly cssModifier: string;
}

/**
 * Konfigurasi prioritas sesuai enum backend `low | medium | high | urgent`.
 * Label dan bobot sorting tidak pernah dikirim ke API.
 */
export const PRIORITY_CONFIG: readonly PriorityConfig[] = [
  {
    value: 'low',
    label: 'Rendah',
    sortWeight: 1,
    badgeVariant: 'neutral',
    cssModifier: 'low'
  },
  {
    value: 'medium',
    label: 'Sedang',
    sortWeight: 2,
    badgeVariant: 'warning',
    cssModifier: 'medium'
  },
  {
    value: 'high',
    label: 'Tinggi',
    sortWeight: 3,
    badgeVariant: 'danger',
    cssModifier: 'high'
  },
  {
    value: 'urgent',
    label: 'Mendesak',
    sortWeight: 4,
    badgeVariant: 'danger',
    cssModifier: 'urgent'
  }
];

const PRIORITY_MAP = new Map(PRIORITY_CONFIG.map((item) => [item.value, item]));

export function getPriorityConfig(priority: TodoPriority): PriorityConfig {
  return PRIORITY_MAP.get(priority) ?? PRIORITY_CONFIG[0]!;
}

export function getPriorityLabel(priority: TodoPriority): string {
  return getPriorityConfig(priority).label;
}

export function getPriorityWeight(priority: TodoPriority): number {
  return getPriorityConfig(priority).sortWeight;
}
