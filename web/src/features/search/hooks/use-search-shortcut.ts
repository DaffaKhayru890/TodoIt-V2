import { useEffect, useRef } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * Ctrl+K / Cmd+K membuka pencarian. Shortcut tidak diambil saat fokus berada
 * di input lain agar perilaku mengetik pengguna tidak terganggu.
 */
export function useSearchShortcut(onOpen: () => void, enabled = true): void {
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;

      if (!modifier || event.altKey || event.key.toLowerCase() !== 'k') {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      onOpenRef.current();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}

export { isEditableTarget };
