import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialogBehavior } from '@/hooks/use-dialog-behavior';

export function Modal({
  open,
  title,
  children,
  onClose,
  showClose = true,
  showBackdrop = true
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  showClose?: boolean;
  showBackdrop?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(open, onClose, dialogRef);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-root">
      {showBackdrop ? (
        <button
          className="modal-root__backdrop"
          type="button"
          aria-label="Tutup dialog"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {showClose ? (
            <button className="modal__close" type="button" onClick={onClose}>
              Tutup
            </button>
          ) : null}
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
