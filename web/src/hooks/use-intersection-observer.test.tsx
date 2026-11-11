import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useIntersectionObserver } from './use-intersection-observer';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

function targetRef(): RefObject<HTMLDivElement | null> {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return { current: element };
}

describe('useIntersectionObserver', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeIntersectionObserver.instances = [];
    document.body.innerHTML = '';
  });

  test('membuat observer dengan root margin dan threshold yang diberikan', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const target = targetRef();
    const onIntersect = vi.fn();

    const { result } = renderHook(() =>
      useIntersectionObserver({
        targetRef: target,
        rootMargin: '100px',
        threshold: [0, 0.5],
        onIntersect
      })
    );

    const observer = FakeIntersectionObserver.instances[0];

    expect(result.current.isSupported).toBe(true);
    expect(observer?.observe).toHaveBeenCalledWith(target.current);
    expect(observer?.options?.rootMargin).toBe('100px');
    expect(observer?.options?.threshold).toEqual([0, 0.5]);

    observer?.trigger(true);
    expect(onIntersect).toHaveBeenCalledTimes(1);

    observer?.trigger(false);
    expect(onIntersect).toHaveBeenCalledTimes(1);
  });

  test('memakai callback terbaru tanpa membuat observer baru', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const target = targetRef();
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ onIntersect }) => useIntersectionObserver({ targetRef: target, onIntersect }),
      { initialProps: { onIntersect: first } }
    );

    expect(FakeIntersectionObserver.instances).toHaveLength(1);

    rerender({ onIntersect: second });

    expect(FakeIntersectionObserver.instances).toHaveLength(1);

    FakeIntersectionObserver.instances[0]?.trigger(true);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('membersihkan observer ketika disabled', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const target = targetRef();

    const { rerender } = renderHook(
      ({ enabled }) =>
        useIntersectionObserver({ targetRef: target, enabled, onIntersect: vi.fn() }),
      { initialProps: { enabled: true } }
    );

    const observer = FakeIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    rerender({ enabled: false });

    expect(observer?.disconnect).toHaveBeenCalled();
  });

  test('melaporkan unsupported ketika IntersectionObserver tidak tersedia', () => {
    Reflect.deleteProperty(window, 'IntersectionObserver');

    const { result } = renderHook(() =>
      useIntersectionObserver({ targetRef: targetRef(), onIntersect: vi.fn() })
    );

    expect(result.current.isSupported).toBe(false);
  });

  test('tidak membuat observer ketika target belum terpasang', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const onIntersect = vi.fn();

    renderHook(() => useIntersectionObserver({ targetRef: { current: null }, onIntersect }));

    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });
});
