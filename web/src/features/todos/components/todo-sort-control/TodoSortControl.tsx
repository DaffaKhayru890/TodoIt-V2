import { FiArrowDown, FiArrowUp } from 'react-icons/fi';
import {
  TODO_SORT_FIELDS,
  TODO_SORT_LABELS,
  type SortDirection,
  type TodoSort,
  type TodoSortField
} from '../../utils/sort-todos';

export interface TodoSortControlProps {
  readonly sort: TodoSort;
  readonly onChange: (sort: TodoSort) => void;
  readonly disabled?: boolean;
}

export function TodoSortControl({ sort, onChange, disabled = false }: TodoSortControlProps) {
  const directionLabel = sort.direction === 'asc' ? 'Naik' : 'Turun';
  const nextDirection: SortDirection = sort.direction === 'asc' ? 'desc' : 'asc';

  return (
    <div className="todo-sort" role="group" aria-label="Pengurutan tugas">
      <label className="todo-sort__label" htmlFor="todo-sort-field">
        Urutkan
      </label>
      <select
        id="todo-sort-field"
        className="todo-sort__select"
        value={sort.field}
        disabled={disabled}
        onChange={(event) => onChange({ ...sort, field: event.target.value as TodoSortField })}
      >
        {TODO_SORT_FIELDS.map((field) => (
          <option key={field} value={field}>
            {TODO_SORT_LABELS[field]}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="todo-sort__direction"
        aria-label={`Arah pengurutan: ${directionLabel}. Klik untuk mengubah.`}
        aria-pressed={sort.direction === 'desc'}
        disabled={disabled}
        onClick={() => onChange({ ...sort, direction: nextDirection })}
      >
        {sort.direction === 'asc' ? (
          <FiArrowUp aria-hidden="true" />
        ) : (
          <FiArrowDown aria-hidden="true" />
        )}
        <span>{directionLabel}</span>
      </button>
    </div>
  );
}
