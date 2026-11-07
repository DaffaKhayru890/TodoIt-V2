import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { joinClasses } from '@/core/utils/join-classes';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={joinClasses(
        'button',
        `button--${variant}`,
        `button--${size}`,
        loading && 'button--loading',
        fullWidth && 'button--full',
        className
      )}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {leadingIcon ? <span className="button__icon">{leadingIcon}</span> : null}
      <span className="button__label">{children}</span>
      {trailingIcon ? <span className="button__icon">{trailingIcon}</span> : null}
    </button>
  );
}
