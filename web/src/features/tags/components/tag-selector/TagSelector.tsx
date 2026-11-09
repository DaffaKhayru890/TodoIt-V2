import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import type { Tag } from '../../models/tag.model';

export interface TagSelectorProps {
  readonly tags: readonly Tag[] | undefined;
  readonly selectedIds: readonly string[];
  readonly onChange: (tagIds: readonly string[]) => void;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
  readonly disabled?: boolean;
  readonly emptyMessage?: string;
}

export function TagSelector({
  tags,
  selectedIds,
  onChange,
  isLoading = false,
  isError = false,
  onRetry,
  disabled = false,
  emptyMessage = 'Belum ada tag di workspace ini.'
}: TagSelectorProps) {
  const hintId = useId();

  const toggle = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
      return;
    }

    onChange([...selectedIds, tagId]);
  };

  return (
    <fieldset className="tag-selector" aria-describedby={hintId} disabled={disabled}>
      <legend className="tag-selector__legend">Tag</legend>
      <p className="tag-selector__hint" id={hintId}>
        Pilih satu atau beberapa tag. Pengelolaan tag tersedia di menu Tags.
      </p>

      {isLoading ? (
        <p className="tag-selector__state" role="status">
          Memuat tag...
        </p>
      ) : null}

      {isError ? (
        <div className="tag-selector__state tag-selector__state--error" role="alert">
          <span>Gagal memuat tag.</span>
          {onRetry ? (
            <button type="button" className="tag-selector__retry" onClick={onRetry}>
              Coba lagi
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && (tags?.length ?? 0) === 0 ? (
        <p className="tag-selector__state">{emptyMessage}</p>
      ) : null}

      {!isLoading && !isError && (tags?.length ?? 0) > 0 ? (
        <div className="tag-selector__options">
          {tags?.map((tag) => (
            <Checkbox
              key={tag.id}
              label={tag.name}
              checked={selectedIds.includes(tag.id)}
              disabled={disabled}
              onChange={() => toggle(tag.id)}
            />
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
