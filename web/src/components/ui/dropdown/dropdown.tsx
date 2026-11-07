import { useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useDismissable } from '@/hooks/use-dismissable';
import { joinClasses } from '@/core/utils/join-classes';

export function Dropdown({
  label,
  children,
  placement = 'down'
}: {
  label: string;
  children: ReactNode;
  placement?: 'down' | 'up';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismissable(open, () => setOpen(false), rootRef);

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        className="dropdown__trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={joinClasses('dropdown__menu', placement === 'up' && 'dropdown__menu--up')}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onSelect,
  to
}: {
  children: ReactNode;
  onSelect?: () => void;
  to?: string;
}) {
  if (to) {
    return (
      <Link className="dropdown__item" role="menuitem" to={to} onClick={onSelect}>
        {children}
      </Link>
    );
  }

  return (
    <button className="dropdown__item" type="button" role="menuitem" onClick={onSelect}>
      {children}
    </button>
  );
}
