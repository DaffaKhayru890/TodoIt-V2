import { useId, type TextareaHTMLAttributes } from 'react';
import { joinClasses } from '@/core/utils/join-classes';

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  resize?: 'none' | 'vertical' | undefined;
  id?: string | undefined;
};

export function Textarea({
  label,
  hint,
  error,
  resize = 'vertical',
  id,
  required,
  disabled,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <div
      className={joinClasses(
        'field',
        error && 'field--error',
        disabled && 'field--disabled',
        className
      )}
    >
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__control">
        <textarea
          id={inputId}
          className={joinClasses('field__textarea', resize === 'none' && 'field__textarea--none')}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
      </div>
      {hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
