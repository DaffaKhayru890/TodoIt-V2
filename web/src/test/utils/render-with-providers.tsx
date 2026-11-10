import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { createQueryClient } from '@/app/providers/query-client';
import { ToastProvider } from '@/components/ui/toast/toast-provider';

export function renderWithProviders(ui: ReactElement, path = '/'): RenderResult {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
