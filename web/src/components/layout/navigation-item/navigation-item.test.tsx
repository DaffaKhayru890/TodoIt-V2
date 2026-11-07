import { screen } from '@testing-library/react';
import { FiInbox } from 'react-icons/fi';
import { describe, expect, test } from 'vitest';
import { NavigationItem } from '@/components/layout/navigation-item/navigation-item';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('NavigationItem', () => {
  test('menandai rute aktif', () => {
    renderWithProviders(
      <ul>
        <NavigationItem
          item={{ id: 'inbox', label: 'Inbox', href: '/inbox', icon: FiInbox }}
          collapsed={false}
        />
      </ul>,
      '/inbox'
    );

    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveClass('nav-item--active');
  });
});
