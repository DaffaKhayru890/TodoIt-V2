import { screen } from '@testing-library/react';
import { FiInbox } from 'react-icons/fi';
import { describe, expect, test } from 'vitest';
import { NavigationSection } from '@/components/layout/navigation-section/navigation-section';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('NavigationSection', () => {
  test('merender judul dan tautan', () => {
    renderWithProviders(
      <NavigationSection
        collapsed={false}
        section={{
          id: 'general',
          title: 'General',
          items: [{ id: 'inbox', label: 'Inbox', href: '/inbox', icon: FiInbox }]
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('href', '/inbox');
  });
});
