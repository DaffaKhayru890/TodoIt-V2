import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface UseSearchKeyboardOptions {
  readonly itemCount: number;
  readonly resetKey: string;
  readonly onSelect: (index: number) => void;
  readonly onSubmit: () => void;
}

/**
 * Mengelola active descendant pada combobox pencarian. Hanya tombol navigasi
 * yang dicegah supaya perilaku native input (termasuk Ctrl+A) tetap utuh.
 */
export function useSearchKeyboard({
  itemCount,
  resetKey,
  onSelect,
  onSubmit
}: UseSearchKeyboardOptions) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  const state = useRef({ itemCount, onSelect, onSubmit });

  // Pola "adjust state during render": reset active option tanpa effect.
  if (previousResetKey !== resetKey) {
    setPreviousResetKey(resetKey);
    setActiveIndex(-1);
  }

  useEffect(() => {
    state.current = { itemCount, onSelect, onSubmit };
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      if (state.current.itemCount === 0) {
        return;
      }

      event.preventDefault();
      setActiveIndex((current) => (current >= state.current.itemCount - 1 ? 0 : current + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      if (state.current.itemCount === 0) {
        return;
      }

      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? state.current.itemCount - 1 : current - 1));
      return;
    }

    if (event.key === 'Home') {
      if (state.current.itemCount === 0) {
        return;
      }

      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End') {
      if (state.current.itemCount === 0) {
        return;
      }

      event.preventDefault();
      setActiveIndex(state.current.itemCount - 1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (activeIndex >= 0 && activeIndex < state.current.itemCount) {
        state.current.onSelect(activeIndex);
        return;
      }

      state.current.onSubmit();
    }
  }

  return { activeIndex, setActiveIndex, handleKeyDown };
}
