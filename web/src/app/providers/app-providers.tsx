import type { ReactNode } from 'react';
import { QueryProvider } from '@/app/providers/query-provider';
import { ToastProvider } from '@/components/ui/toast/toast-provider';

export function AppProviders({ children }: { readonly children: ReactNode }) {
  return (
    <QueryProvider>
      <ToastProvider>{children}</ToastProvider>
    </QueryProvider>
  );
}
