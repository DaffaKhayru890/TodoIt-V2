import { useEffect, useRef, type RefObject } from 'react';

export interface UseIntersectionObserverOptions {
  readonly targetRef: RefObject<Element | null>;
  readonly rootRef?: RefObject<Element | null>;
  readonly rootMargin?: string;
  readonly threshold?: number | readonly number[];
  readonly enabled?: boolean;
  readonly onIntersect: () => void;
}

const DEFAULT_ROOT_MARGIN = '200px';

/**
 * Observer dibuat sekali per konfigurasi dan selalu dibersihkan saat disabled
 * atau unmount. Callback disimpan di ref agar re-render tidak membuat observer
 * baru atau memicu request berulang.
 */
export function useIntersectionObserver({
  targetRef,
  rootRef,
  rootMargin = DEFAULT_ROOT_MARGIN,
  threshold = 0,
  enabled = true,
  onIntersect
}: UseIntersectionObserverOptions): { readonly isSupported: boolean } {
  const onIntersectRef = useRef(onIntersect);

  useEffect(() => {
    onIntersectRef.current = onIntersect;
  });

  useEffect(() => {
    const target = targetRef.current;

    if (!enabled || !target || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observerThreshold =
      threshold === undefined
        ? undefined
        : typeof threshold === 'number'
          ? threshold
          : [...threshold];

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onIntersectRef.current();
        }
      },
      {
        root: rootRef?.current ?? null,
        rootMargin,
        ...(observerThreshold === undefined ? {} : { threshold: observerThreshold })
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [enabled, rootMargin, threshold, targetRef, rootRef]);

  return { isSupported: typeof IntersectionObserver !== 'undefined' };
}
