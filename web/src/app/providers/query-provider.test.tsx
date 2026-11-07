import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { QueryProvider } from '@/app/providers/query-provider';

function Probe() {
  const client = useQueryClient();

  const retry = client.getDefaultOptions().queries?.retry;

  return <p>retry {typeof retry === 'number' ? retry : 'custom'}</p>;
}

describe('QueryProvider', () => {
  test('menyediakan QueryClient ke aplikasi', () => {
    render(
      <QueryProvider>
        <Probe />
      </QueryProvider>
    );

    expect(screen.getByText('retry 1')).toBeInTheDocument();
  });
});
