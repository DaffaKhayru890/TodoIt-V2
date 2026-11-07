import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { App } from '@/app/app';

describe('App', () => {
  test('merender halaman beranda', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Fondasi frontend siap.' })).toBeInTheDocument();
  });
});
