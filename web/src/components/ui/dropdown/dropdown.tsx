import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useDismissable } from '@/hooks/use-dismissable';
import { joinClasses } from '@/core/utils/join-classes';

const DropdownCloseContext = createContext<() => void>(() => undefined);

export function Dropdown({
  label,
  children,
  placement = 'down',
  ariaLabel
}: {
  label: ReactNode;
  children: ReactNode;
  placement?: 'down' | 'up';
  ariaLabel?: string;
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
        aria-label={ariaLabel}
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
        <DropdownCloseContext.Provider value={() => setOpen(false)}>
          <div
            id={menuId}
            role="menu"
            className={joinClasses('dropdown__menu', placement === 'up' && 'dropdown__menu--up')}
          >
            {children}
          </div>
        </DropdownCloseContext.Provider>
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
  const close = useContext(DropdownCloseContext);

  const handleSelect = () => {
    close();
    onSelect?.();
  };

  if (to) {
    return (
      <Link className="dropdown__item" role="menuitem" to={to} onClick={handleSelect}>
        {children}
      </Link>
    );
  }

  return (
    <button className="dropdown__item" type="button" role="menuitem" onClick={handleSelect}>
      {children}
    </button>
  );
}
