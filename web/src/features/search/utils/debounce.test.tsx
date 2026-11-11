import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useDebouncedValue } from './debounce';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('menunda propagasi nilai sampai delay selesai', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' }
    });

    rerender({ value: 'back' });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('back');
  });

  test('hanya nilai terakhir yang dipropagasikan saat mengetik cepat', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'b' }
    });

    rerender({ value: 'ba' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'bac' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'back' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('b');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('back');
  });

  test('delay negatif diperlakukan sebagai nol', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, -50), {
      initialProps: { value: 'a' }
    });

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('b');
  });

  test('timer dibersihkan saat unmount', () => {
    const { unmount } = renderHook(() => useDebouncedValue('nilai', 300));
    const timerCount = vi.getTimerCount();

    unmount();

    expect(vi.getTimerCount()).toBeLessThan(timerCount);
  });
});
