/**
 * Prioritas Todo adalah dimensi yang terpisah dari status.
 * Urutan konseptual: URGENT > HIGH > MEDIUM > LOW.
 */
export const TodoPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
} as const;

export type TodoPriority = (typeof TodoPriority)[keyof typeof TodoPriority];

export const TODO_PRIORITIES: readonly TodoPriority[] = [
  TodoPriority.LOW,
  TodoPriority.MEDIUM,
  TodoPriority.HIGH,
  TodoPriority.URGENT
];

/** Bobot dipakai untuk sorting/filter bila dibutuhkan; bukan nilai database. */
export const TODO_PRIORITY_WEIGHT: Readonly<Record<TodoPriority, number>> = {
  [TodoPriority.LOW]: 1,
  [TodoPriority.MEDIUM]: 2,
  [TodoPriority.HIGH]: 3,
  [TodoPriority.URGENT]: 4
};

export function isTodoPriority(value: string): value is TodoPriority {
  return (TODO_PRIORITIES as readonly string[]).includes(value);
}
