import { useEffect, useRef } from 'react';
import { readScrollPosition, writeScrollPosition } from './scroll-position-storage';

const SCROLL_CONTAINER_ID = 'main-content';
const WRITE_DELAY_MS = 150;

function getScrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.getElementById(SCROLL_CONTAINER_ID);
}

export interface UseScrollRestorationOptions {
  /** Key stabil per workspace + filter + sorting. */
  readonly storageKey: string;
  /** True setelah data list tersedia dan list sudah dirender. */
  readonly ready: boolean;
}

/**
 * Mempertahankan posisi scroll `#main-content` ketika pengguna kembali dari
 * halaman detail. Restoration hanya dilakukan sekali per mount dan setelah
 * data tersedia; perubahan key (filter/sorting) mereset posisi ke atas karena
 * dataset yang ditampilkan berbeda.
 */
export function useScrollRestoration({ storageKey, ready }: UseScrollRestorationOptions): void {
  const positionRef = useRef(0);
  const restoredRef = useRef(false);
  const previousKeyRef = useRef(storageKey);

  useEffect(() => {
    const container = getScrollContainer();

    if (!container) {
      return;
    }

    if (previousKeyRef.current !== storageKey) {
      previousKeyRef.current = storageKey;
      restoredRef.current = false;
      container.scrollTop = 0;
    }
  }, [storageKey]);

  useEffect(() => {
    const container = getScrollContainer();

    if (!container) {
      return;
    }

    positionRef.current = container.scrollTop;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      positionRef.current = container.scrollTop;

      if (timer !== null) {
        return;
      }

      timer = setTimeout(() => {
        timer = null;
        writeScrollPosition(storageKey, positionRef.current);
      }, WRITE_DELAY_MS);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);

      if (timer !== null) {
        clearTimeout(timer);
      }

      writeScrollPosition(storageKey, positionRef.current);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ready || restoredRef.current) {
      return;
    }

    const container = getScrollContainer();

    if (!container) {
      return;
    }

    const saved = readScrollPosition(storageKey);

    if (saved > 0) {
      container.scrollTop = saved;
      positionRef.current = container.scrollTop;
    }

    restoredRef.current = true;
  }, [ready, storageKey]);
}
