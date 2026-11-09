import { useId } from 'react';
import type { Label } from '../../models/label.model';

export interface LabelSelectorProps {
  readonly labels: readonly Label[] | undefined;
  readonly selectedId: string | null;
  readonly onChange: (labelId: string | null) => void;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
  readonly disabled?: boolean;
}

export function LabelSelector({
  labels,
  selectedId,
  onChange,
  isLoading = false,
  isError = false,
  onRetry,
  disabled = false
}: LabelSelectorProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="label-selector">
      <label className="label-selector__label" htmlFor={id}>
        Label
      </label>
      <p className="label-selector__hint" id={hintId}>
        Satu tugas hanya dapat memiliki satu label.
      </p>

      {isLoading ? (
        <p className="label-selector__state" role="status">
          Memuat label...
        </p>
      ) : null}

      {isError ? (
        <div className="label-selector__state label-selector__state--error" role="alert">
          <span>Gagal memuat label.</span>
          {onRetry ? (
            <button type="button" className="label-selector__retry" onClick={onRetry}>
              Coba lagi
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <select
          id={id}
          className="label-selector__select"
          value={selectedId ?? ''}
          aria-describedby={hintId}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Tanpa label</option>
          {(labels ?? []).map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      ) : null}

      {!isLoading && !isError && (labels?.length ?? 0) === 0 ? (
        <p className="label-selector__state">Belum ada label di workspace ini.</p>
      ) : null}
    </div>
  );
}
