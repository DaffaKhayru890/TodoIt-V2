import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const thirdId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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

  trigger() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

function mockInfiniteTodos() {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');

      if (!cursor) {
        return HttpResponse.json({
          items: [
            makeTodoDto({ id: firstId, title: 'Infinite satu' }),
            makeTodoDto({ id: secondId, title: 'Infinite dua' })
          ],
          pagination: { limit: 30, hasMore: true, nextCursor: 'cursor-2' }
        });
      }

      return HttpResponse.json({
        items: [
          makeTodoDto({ id: secondId, title: 'Infinite dua' }),
          makeTodoDto({ id: thirdId, title: 'Infinite tiga' })
        ],
        pagination: { limit: 30, hasMore: false, nextCursor: null }
      });
    })
  );
}

describe('Infinite scrolling workflows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeIntersectionObserver.instances = [];
    localStorage.clear();
  });

  test('Workflow C — sentinel memuat halaman berikutnya dan menggabungkan tanpa duplikat', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    mockInfiniteTodos();

    renderWithProviders(<AppRoutes />, `/workspace/${workspaceId}`);

    expect(await screen.findByText('Infinite satu')).toBeInTheDocument();
    expect(screen.getByText('Infinite dua')).toBeInTheDocument();

    await waitFor(() => expect(FakeIntersectionObserver.instances.length).toBeGreaterThan(0));
    FakeIntersectionObserver.instances.forEach((observer) => observer.trigger());

    expect(await screen.findByText('Infinite tiga')).toBeInTheDocument();
    expect(screen.getAllByText('Infinite dua')).toHaveLength(1);
    expect(await screen.findByText('Semua tugas sudah dimuat.')).toBeInTheDocument();
  });

  test('Workflow C fallback — tombol Muat lebih banyak tetap bekerja tanpa IntersectionObserver', async () => {
    reflectDeleteIntersectionObserver();
    mockInfiniteTodos();

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, `/workspace/${workspaceId}`);

    expect(await screen.findByText('Infinite satu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Muat lebih banyak' }));

    expect(await screen.findByText('Infinite tiga')).toBeInTheDocument();
    expect(screen.getAllByText('Infinite dua')).toHaveLength(1);
  });

  test('Workflow D — posisi scroll dipulihkan setelah kembali dari detail tugas', async () => {
    reflectDeleteIntersectionObserver();
    mockInfiniteTodos();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${firstId}`, () =>
        HttpResponse.json({
          todo: makeTodoDto({ id: firstId, title: 'Infinite satu' })
        })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, `/workspace/${workspaceId}`);

    await screen.findByText('Infinite satu');

    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    main!.scrollTop = 400;
    main!.dispatchEvent(new Event('scroll'));

    await user.click(screen.getByRole('link', { name: 'Buka detail tugas Infinite satu' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Infinite satu' })
    ).toBeInTheDocument();

    const saved = Object.keys(localStorage).find((key) =>
      key.startsWith('todoit.scroll.workspace.v1')
    );
    expect(saved).toBeDefined();
    expect(localStorage.getItem(saved ?? '')).toBe('400');

    await user.click(screen.getByRole('link', { name: 'Kembali ke workspace' }));

    await screen.findByText('Infinite dua');

    await waitFor(() => expect(main?.scrollTop).toBe(400));
  });
});

function reflectDeleteIntersectionObserver() {
  Reflect.deleteProperty(window, 'IntersectionObserver');
}
