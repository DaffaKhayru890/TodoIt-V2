import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip/tooltip';
import { joinClasses } from '@/core/utils/join-classes';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  children: ReactNode;
  tooltip?: string;
  loading?: boolean;
};

export function IconButton({
  label,
  children,
  tooltip,
  loading = false,
  className,
  type = 'button',
  disabled,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      className={joinClasses('icon-button', loading && 'icon-button--loading', className)}
      type={type}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="icon-button__glyph" aria-hidden="true">
        {children}
      </span>
    </button>
  );

  if (!tooltip) {
    return button;
  }

  return <Tooltip label={tooltip}>{button}</Tooltip>;
}
