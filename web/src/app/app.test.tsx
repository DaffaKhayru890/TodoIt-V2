import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { App } from '@/app/app';

describe('App', () => {
  test('merender shell aplikasi pada inbox', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TodoIt' })).toBeInTheDocument();
  });
});
