import type { ReactNode } from 'react';
import { FiFilter, FiX } from 'react-icons/fi';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { Popover } from '@/components/ui/popover/popover';
import type { Label } from '@/features/labels/models/label.model';
import type { Tag } from '@/features/tags/models/tag.model';
import {
  TODO_DUE_FILTERS,
  TODO_DUE_FILTER_LABELS,
  TODO_STATUS_FILTERS,
  TODO_STATUS_FILTER_LABELS,
  countActiveTodoFilters,
  hasActiveTodoFilters,
  type TodoFilterState,
  type TodoStatusFilter
} from '../../models/todo-filter';
import { PRIORITY_CONFIG } from '../../models/todo-priority';
import type { TodoPriority } from '../../models/todo.model';

export interface TodoFilterPanelProps {
  readonly filter: TodoFilterState;
  readonly onChange: (filter: TodoFilterState) => void;
  readonly tags: readonly Tag[];
  readonly labels: readonly Label[];
  readonly isLoadingTags?: boolean;
  readonly isLoadingLabels?: boolean;
  readonly disabled?: boolean;
}

interface FilterSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <div className="todo-filter__section">
      <h3 className="todo-filter__section-title">{title}</h3>
      {children}
    </div>
  );
}

interface ActiveFilterChipProps {
  readonly label: string;
  readonly onRemove: () => void;
}

export function ActiveFilterChip({ label, onRemove }: ActiveFilterChipProps) {
  return (
    <span className="todo-filter__chip">
      <span className="todo-filter__chip-label">{label}</span>
      <button
        type="button"
        className="todo-filter__chip-remove"
        aria-label={`Hapus filter ${label}`}
        onClick={onRemove}
      >
        <FiX aria-hidden="true" />
      </button>
    </span>
  );
}

function statusLabel(status: TodoStatusFilter): string {
  return `Status: ${TODO_STATUS_FILTER_LABELS[status]}`;
}

function priorityLabel(priority: TodoPriority): string {
  return `Prioritas: ${PRIORITY_CONFIG.find((item) => item.value === priority)?.label ?? priority}`;
}

export function TodoFilterPanel({
  filter,
  onChange,
  tags,
  labels,
  isLoadingTags = false,
  isLoadingLabels = false,
  disabled = false
}: TodoFilterPanelProps) {
  const activeCount = countActiveTodoFilters(filter);
  const hasFilters = hasActiveTodoFilters(filter);

  const patch = (partial: Partial<TodoFilterState>) => {
    onChange({ ...filter, ...partial });
  };

  const toggleTag = (tagId: string) => {
    patch({
      tagIds: filter.tagIds.includes(tagId)
        ? filter.tagIds.filter((id) => id !== tagId)
        : [...filter.tagIds, tagId]
    });
  };

  const activeTagIds = new Set(filter.tagIds);
  const activeLabel = labels.find((label) => label.id === filter.labelId);

  return (
    <div className="todo-filter">
      <div className="todo-filter__toolbar">
        <Popover label={activeCount > 0 ? `Filter (${activeCount})` : 'Filter'}>
          <div className="todo-filter__panel" aria-label="Panel filter tugas">
            <div className="todo-filter__panel-header">
              <span className="todo-filter__panel-title">
                <FiFilter aria-hidden="true" /> Filter Tugas
              </span>
              {hasFilters ? (
                <button
                  type="button"
                  className="todo-filter__clear-all"
                  onClick={() => onChange({ ...filter, ...emptyFilterPatch() })}
                >
                  Hapus semua
                </button>
              ) : null}
            </div>

            <FilterSection title="Status">
              <select
                className="todo-filter__select"
                aria-label="Filter status"
                value={filter.status}
                disabled={disabled}
                onChange={(event) => patch({ status: event.target.value as TodoStatusFilter })}
              >
                {TODO_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {TODO_STATUS_FILTER_LABELS[status]}
                  </option>
                ))}
              </select>
            </FilterSection>

            <FilterSection title="Prioritas">
              <select
                className="todo-filter__select"
                aria-label="Filter prioritas"
                value={filter.priority}
                disabled={disabled}
                onChange={(event) => {
                  const value = event.target.value;
                  patch({ priority: value === 'all' ? 'all' : (value as TodoPriority) });
                }}
              >
                <option value="all">Semua prioritas</option>
                {PRIORITY_CONFIG.map((config) => (
                  <option key={config.value} value={config.value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </FilterSection>

            <FilterSection title="Tenggat">
              <select
                className="todo-filter__select"
                aria-label="Filter tenggat"
                value={filter.due}
                disabled={disabled}
                onChange={(event) =>
                  patch({
                    due: event.target.value as TodoFilterState['due'],
                    ...(event.target.value === 'custom'
                      ? {}
                      : { customFrom: null, customTo: null })
                  })
                }
              >
                {TODO_DUE_FILTERS.map((due) => (
                  <option key={due} value={due}>
                    {TODO_DUE_FILTER_LABELS[due]}
                  </option>
                ))}
              </select>

              {filter.due === 'custom' ? (
                <div className="todo-filter__date-range">
                  <label className="todo-filter__date-field">
                    <span>Dari</span>
                    <input
                      type="date"
                      className="todo-filter__date-input"
                      value={filter.customFrom ?? ''}
                      disabled={disabled}
                      onChange={(event) =>
                        patch({ customFrom: event.target.value || null })
                      }
                    />
                  </label>
                  <label className="todo-filter__date-field">
                    <span>Sampai</span>
                    <input
                      type="date"
                      className="todo-filter__date-input"
                      value={filter.customTo ?? ''}
                      disabled={disabled}
                      onChange={(event) => patch({ customTo: event.target.value || null })}
                    />
                  </label>
                </div>
              ) : null}
            </FilterSection>

            <FilterSection title="Tag">
              {isLoadingTags ? <p className="todo-filter__state">Memuat tag...</p> : null}
              {!isLoadingTags && tags.length === 0 ? (
                <p className="todo-filter__state">Belum ada tag di workspace ini.</p>
              ) : null}
              {!isLoadingTags && tags.length > 0 ? (
                <div className="todo-filter__options">
                  {tags.map((tag) => (
                    <Checkbox
                      key={tag.id}
                      label={tag.name}
                      checked={activeTagIds.has(tag.id)}
                      disabled={disabled}
                      onChange={() => toggleTag(tag.id)}
                    />
                  ))}
                </div>
              ) : null}
            </FilterSection>

            <FilterSection title="Label">
              {isLoadingLabels ? <p className="todo-filter__state">Memuat label...</p> : null}
              {!isLoadingLabels && labels.length === 0 ? (
                <p className="todo-filter__state">Belum ada label di workspace ini.</p>
              ) : null}
              {!isLoadingLabels && labels.length > 0 ? (
                <select
                  className="todo-filter__select"
                  aria-label="Filter label"
                  value={filter.labelId ?? ''}
                  disabled={disabled}
                  onChange={(event) => patch({ labelId: event.target.value || null })}
                >
                  <option value="">Semua label</option>
                  {labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </FilterSection>
          </div>
        </Popover>

        {!hasFilters ? (
          <span className="todo-filter__toolbar-note">Tidak ada filter aktif.</span>
        ) : null}
      </div>

      {hasFilters ? (
        <div className="todo-filter__chips" aria-label="Filter aktif">
          {filter.status !== 'all' ? (
            <ActiveFilterChip
              label={statusLabel(filter.status)}
              onRemove={() => patch({ status: 'all' })}
            />
          ) : null}

          {filter.priority !== 'all' ? (
            <ActiveFilterChip
              label={priorityLabel(filter.priority)}
              onRemove={() => patch({ priority: 'all' })}
            />
          ) : null}

          {filter.due !== 'any' ? (
            <ActiveFilterChip
              label={`Tenggat: ${TODO_DUE_FILTER_LABELS[filter.due]}`}
              onRemove={() => patch({ due: 'any', customFrom: null, customTo: null })}
            />
          ) : null}

          {filter.tagIds.map((tagId) => {
            const tag = tags.find((item) => item.id === tagId);
            return (
              <ActiveFilterChip
                key={tagId}
                label={`Tag: ${tag?.name ?? tagId}`}
                onRemove={() => toggleTag(tagId)}
              />
            );
          })}

          {filter.labelId ? (
            <ActiveFilterChip
              label={`Label: ${activeLabel?.name ?? filter.labelId}`}
              onRemove={() => patch({ labelId: null })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function emptyFilterPatch(): Partial<TodoFilterState> {
  return {
    status: 'all',
    priority: 'all',
    tagIds: [],
    labelId: null,
    due: 'any',
    customFrom: null,
    customTo: null
  };
}
