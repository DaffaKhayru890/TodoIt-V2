import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { MainContent } from '@/components/layout/main-content/main-content';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('MainContent', () => {
  test('menampilkan outlet rute anak', () => {
    renderWithProviders(
      <Routes>
        <Route element={<MainContent />}>
          <Route path="/inbox" element={<h1>Dari outlet</h1>} />
        </Route>
      </Routes>,
      '/inbox'
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dari outlet' })).toBeInTheDocument();
  });
});
