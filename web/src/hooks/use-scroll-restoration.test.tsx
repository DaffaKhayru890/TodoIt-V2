import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readScrollPosition, writeScrollPosition } from './scroll-position-storage';
import { useScrollRestoration } from './use-scroll-restoration';

const KEY = 'test.scroll.key';

function createContainer(): HTMLElement {
  const existing = document.getElementById('main-content');

  if (existing) {
    return existing;
  }

  const container = document.createElement('main');
  container.id = 'main-content';
  document.body.appendChild(container);
  return container;
}

describe('useScrollRestoration', () => {
  beforeEach(() => {
    createContainer();
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  test('memulihkan posisi scroll setelah list siap', () => {
    const container = createContainer();
    writeScrollPosition(KEY, 240);

    renderHook(() => useScrollRestoration({ storageKey: KEY, ready: true }));

    expect(container.scrollTop).toBe(240);
  });

  test('tidak memulihkan posisi sebelum data siap', () => {
    const container = createContainer();
    writeScrollPosition(KEY, 240);

    const { rerender } = renderHook(
      ({ ready }) => useScrollRestoration({ storageKey: KEY, ready }),
      { initialProps: { ready: false } }
    );

    expect(container.scrollTop).toBe(0);

    rerender({ ready: true });

    expect(container.scrollTop).toBe(240);
  });

  test('menyimpan posisi saat scroll dan saat unmount', () => {
    const container = createContainer();

    const { unmount } = renderHook(() => useScrollRestoration({ storageKey: KEY, ready: false }));

    container.scrollTop = 320;
    container.dispatchEvent(new Event('scroll'));

    unmount();

    expect(readScrollPosition(KEY)).toBe(320);
  });

  test('perubahan storage key mereset scroll ke atas dan tidak memulihkan posisi lama', () => {
    const container = createContainer();
    writeScrollPosition('key-a', 100);

    const { rerender } = renderHook(
      ({ key }) => useScrollRestoration({ storageKey: key, ready: true }),
      { initialProps: { key: 'key-a' } }
    );

    expect(container.scrollTop).toBe(100);

    rerender({ key: 'key-b' });

    expect(container.scrollTop).toBe(0);
  });

  test('tidak melakukan apa pun tanpa container main-content', () => {
    document.body.innerHTML = '';

    expect(() =>
      renderHook(() => useScrollRestoration({ storageKey: KEY, ready: true }))
    ).not.toThrow();
  });
});
