/**
 * Penyimpanan posisi scroll aplikasi.
 *
 * Browser history restoration tidak dipakai karena scroll container aplikasi
 * adalah `#main-content`, bukan window. Posisi disimpan per storage key agar
 * workspace/filter yang berbeda tidak saling menimpa.
 */
export interface ScrollStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(): ScrollStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readScrollPosition(
  key: string,
  storage: ScrollStorage | null = resolveStorage()
): number {
  if (!storage) {
    return 0;
  }

  try {
    const raw = storage.getItem(key);

    if (!raw) {
      return 0;
    }

    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeScrollPosition(
  key: string,
  value: number,
  storage: ScrollStorage | null = resolveStorage()
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, String(Math.max(0, Math.round(value))));
  } catch {
    // Storage penuh/diblokir tidak boleh mengganggu navigasi.
  }
}

export function clearScrollPosition(
  key: string,
  storage: ScrollStorage | null = resolveStorage()
): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Diabaikan dengan alasan yang sama seperti write.
  }
}
