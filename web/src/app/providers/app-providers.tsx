import type { ReactNode } from 'react';
import { QueryProvider } from '@/app/providers/query-provider';

export function AppProviders({ children }: { readonly children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
