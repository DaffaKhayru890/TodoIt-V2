import { AppProviders } from '@/app/providers/app-providers';
import { AppRouter } from '@/app/router/router';

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
