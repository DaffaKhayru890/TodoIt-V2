import { useEffect, useState } from 'react';

/**
 * Menunda propagasi nilai sampai pengguna berhenti mengetik. Timer selalu
 * dibersihkan ketika nilai berubah atau komponen unmount sehingga tidak ada
 * request untuk karakter yang sudah tidak relevan.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setDebounced(value);
      },
      Math.max(0, delay)
    );

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}
