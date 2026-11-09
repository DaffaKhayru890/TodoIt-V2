import { useId } from 'react';
import { FiCalendar, FiX } from 'react-icons/fi';
import { joinClasses } from '@/core/utils/join-classes';
import {
  parseDateTimeInputValue,
  toDateTimeInputValue,
  formatDateTime
} from '../../utils/date-format';
import { addLocalDays, setLocalTime, startOfLocalDay } from '../../utils/due-date';

export interface DueDateFieldProps {
  /** Nilai `datetime-local` lokal (`YYYY-MM-DDTHH:mm`) atau string kosong. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly error?: string | undefined;
  /** Injected clock agar shortcut dan test deterministik. */
  readonly now?: Date | undefined;
}

interface Shortcut {
  readonly id: string;
  readonly label: string;
  readonly offsetDays: number;
}

const SHORTCUTS: readonly Shortcut[] = [
  { id: 'today', label: 'Hari ini', offsetDays: 0 },
  { id: 'tomorrow', label: 'Besok', offsetDays: 1 },
  { id: 'next-week', label: 'Minggu depan', offsetDays: 7 }
];

/**
 * Backend menerima instant ISO 8601. Input `datetime-local` dibaca sebagai
 * waktu lokal perangkat lalu diserialkan ke UTC oleh mapper, sehingga tidak
 * ada pergeseran tanggal yang tidak disengaja.
 */
export function DueDateField({
  value,
  onChange,
  disabled = false,
  error,
  now
}: DueDateFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const current = now ?? new Date();
  const preview = parseDateTimeInputValue(value);

  const applyShortcut = (offsetDays: number) => {
    const date = setLocalTime(addLocalDays(startOfLocalDay(current), offsetDays), 9, 0);
    onChange(toDateTimeInputValue(date));
  };

  return (
    <div className={joinClasses('due-date-field', error && 'due-date-field--error')}>
      <label className="due-date-field__label" htmlFor={id}>
        Tenggat Waktu
      </label>
      <p className="due-date-field__hint" id={hintId}>
        Waktu mengikuti zona waktu perangkat Anda dan disimpan sebagai instant UTC.
      </p>

      <div className="due-date-field__control">
        <FiCalendar className="due-date-field__icon" aria-hidden="true" />
        <input
          id={id}
          type="datetime-local"
          className="due-date-field__input"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hintId}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className="due-date-field__clear"
            aria-label="Hapus tenggat waktu"
            disabled={disabled}
            onClick={() => onChange('')}
          >
            <FiX aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="due-date-field__shortcuts" role="group" aria-label="Pilihan cepat tenggat">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.id}
            type="button"
            className="due-date-field__shortcut"
            disabled={disabled}
            onClick={() => applyShortcut(shortcut.offsetDays)}
          >
            {shortcut.label}
          </button>
        ))}
      </div>

      {preview ? (
        <p className="due-date-field__preview">
          Tenggat: <strong>{formatDateTime(preview)}</strong>
        </p>
      ) : (
        <p className="due-date-field__preview">Tanpa tenggat waktu.</p>
      )}

      {error ? (
        <p className="due-date-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
