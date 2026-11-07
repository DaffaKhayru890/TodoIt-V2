import { useEffect, useId, useRef, type ChangeEvent } from 'react';
import { joinClasses } from '@/core/utils/join-classes';

export function Checkbox({
  label,
  checked,
  defaultChecked,
  indeterminate = false,
  disabled = false,
  onChange
}: {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const controlProps = checked === undefined ? { defaultChecked } : { checked };

  return (
    <label className={joinClasses('checkbox', disabled && 'checkbox--disabled')} htmlFor={id}>
      <input
        ref={inputRef}
        id={id}
        className="checkbox__input"
        type="checkbox"
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        onChange={onChange}
        {...controlProps}
      />
      <span className="checkbox__box" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
