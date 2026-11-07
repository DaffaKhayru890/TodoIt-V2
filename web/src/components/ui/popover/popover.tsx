import { useId, useRef, useState, type ReactNode } from 'react';
import { useDismissable } from '@/hooks/use-dismissable';

export function Popover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useDismissable(open, () => setOpen(false), rootRef);

  return (
    <div className="popover" ref={rootRef}>
      <button
        className="popover__trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div id={panelId} className="popover__panel">
          {children}
        </div>
      ) : null}
    </div>
  );
}
