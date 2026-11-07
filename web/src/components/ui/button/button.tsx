import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = 'button', ...props }: ButtonProps) {
  const classes = className ? `button ${className}` : 'button';

  return <button className={classes} type={type} {...props} />;
}
