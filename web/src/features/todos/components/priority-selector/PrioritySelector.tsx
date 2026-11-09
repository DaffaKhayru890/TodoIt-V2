import { useId } from 'react';
import { PRIORITY_CONFIG } from '../../models/todo-priority';
import type { TodoPriority } from '../../models/todo.model';

export interface PrioritySelectorProps {
  readonly value: TodoPriority;
  readonly onChange: (priority: TodoPriority) => void;
  readonly disabled?: boolean;
  readonly error?: string | undefined;
}

/** Selector native agar navigasi keyboard dan screen reader bekerja tanpa JS tambahan. */
export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  error
}: PrioritySelectorProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="priority-selector">
      <label className="priority-selector__label" htmlFor={id}>
        Prioritas
      </label>
      <p className="priority-selector__hint" id={hintId}>
        Prioritas backend: rendah, sedang, tinggi, atau mendesak.
      </p>
      <select
        id={id}
        className="priority-selector__select"
        value={value}
        disabled={disabled}
        aria-describedby={error ? errorId : hintId}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value as TodoPriority)}
      >
        {PRIORITY_CONFIG.map((config) => (
          <option key={config.value} value={config.value}>
            {config.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="priority-selector__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
