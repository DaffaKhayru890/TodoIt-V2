import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { joinClasses } from '@/core/utils/join-classes';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  id?: string | undefined;
};

export function Input({
  label,
  hint,
  error,
  leadingIcon,
  trailingIcon,
  id,
  required,
  disabled,
  className,
  ...props
}: InputProps) {
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
        {leadingIcon ? <span className="field__glyph">{leadingIcon}</span> : null}
        <input
          id={inputId}
          className="field__input"
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
        {trailingIcon ? <span className="field__glyph">{trailingIcon}</span> : null}
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
