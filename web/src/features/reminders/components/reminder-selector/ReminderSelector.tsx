import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox/checkbox';
import { REMINDER_INTERVAL_PRESETS, formatReminderOffset } from '../../models/reminder.model';

export interface ReminderSelectorProps {
  /** Offset menit sebelum due date; `null` berarti pengingat nonaktif. */
  readonly value: number | null;
  readonly onChange: (offsetMinutes: number | null) => void;
  readonly hasDueDate: boolean;
  readonly disabled?: boolean;
  readonly error?: string | undefined;
}

const DEFAULT_OFFSET_MINUTES = 15;

/**
 * Hanya mengirim konfigurasi ke backend. Tidak ada timer browser di sini:
 * penjadwalan dan pengiriman adalah tanggung jawab Notification Engine.
 *
 * Backend mensyaratkan offset minimal 1 menit, sehingga opsi "tepat pada
 * tenggat" tidak disediakan.
 */
export function ReminderSelector({
  value,
  onChange,
  hasDueDate,
  disabled = false,
  error
}: ReminderSelectorProps) {
  const selectId = useId();
  const hintId = useId();
  const errorId = useId();
  const isDisabled = disabled || !hasDueDate;
  const enabled = value !== null;

  return (
    <fieldset className="reminder-selector" aria-describedby={hintId}>
      <legend className="reminder-selector__legend">Pengingat</legend>
      <p className="reminder-selector__hint" id={hintId}>
        Frontend hanya menyimpan jadwal ke backend. Pengiriman notifikasi dijalankan oleh Notification
        Engine, bukan timer browser.
      </p>

      <Checkbox
        label="Aktifkan pengingat"
        checked={enabled}
        disabled={isDisabled}
        onChange={(event) => {
          onChange(event.target.checked ? DEFAULT_OFFSET_MINUTES : null);
        }}
      />

      {!hasDueDate ? (
        <p className="reminder-selector__state" role="status">
          Tetapkan tenggat waktu terlebih dahulu untuk mengaktifkan pengingat.
        </p>
      ) : null}

      {hasDueDate ? (
        <div className="reminder-selector__control">
          <label className="reminder-selector__label" htmlFor={selectId}>
            Waktu pengingat
          </label>
          <select
            id={selectId}
            className="reminder-selector__select"
            value={value ?? DEFAULT_OFFSET_MINUTES}
            disabled={isDisabled || !enabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange(Number(event.target.value))}
          >
            {REMINDER_INTERVAL_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {enabled ? (
        <p className="reminder-selector__summary">
          Pengingat dijadwalkan {formatReminderOffset(value)} tenggat.
        </p>
      ) : null}

      {error ? (
        <p className="reminder-selector__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
