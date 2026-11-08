import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { workspaceFixtures } from '@/test/fixtures/workspaces';
import { PrimarySidebar } from '@/components/layout/primary-sidebar/primary-sidebar';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('PrimarySidebar', () => {
  test('menampilkan workspace contoh, entri tambah, dan profil', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PrimarySidebar collapsed={false} workspaces={workspaceFixtures} />,
      '/inbox'
    );

    expect(screen.getByRole('link', { name: 'TodoIt' })).toBeInTheDocument();
    expect(screen.queryByText('Data contoh')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tambah workspace' })).toHaveAttribute(
      'href',
      '/workspaces/new'
    );
    expect(screen.getByText('Pengguna')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menu pengguna' }));
    expect(screen.getByRole('menuitem', { name: 'Pengaturan' })).toHaveAttribute(
      'href',
      '/settings'
    );
  });

  test('menampilkan skeleton saat loading', () => {
    renderWithProviders(<PrimarySidebar collapsed={false} isLoading={true} />);

    expect(screen.getByLabelText('Memuat daftar workspace')).toBeInTheDocument();
    expect(screen.queryByText('Belum ada workspace.')).not.toBeInTheDocument();
  });

  test('menampilkan indikator error dan tombol coba lagi ketika gagal', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    renderWithProviders(<PrimarySidebar collapsed={false} isError={true} onRetry={handleRetry} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Gagal memuat workspace.')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Coba lagi' });
    await user.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  test('tetap menampilkan workspace dari cache saat refetch gagal', () => {
    renderWithProviders(
      <PrimarySidebar collapsed={false} workspaces={workspaceFixtures} isError={true} />,
      '/inbox'
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.queryByText('Belum ada workspace.')).not.toBeInTheDocument();
  });

  test('menampilkan empty state ketika daftar workspace kosong', () => {
    renderWithProviders(<PrimarySidebar collapsed={false} workspaces={[]} />);

    expect(screen.getByText('Belum ada workspace.')).toBeInTheDocument();
    expect(screen.getByText('Mulai dengan membuat workspace pertama kamu.')).toBeInTheDocument();
  });

  test('memanggil onAddWorkspace ketika tombol tambah ditekan', async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();

    renderWithProviders(
      <PrimarySidebar collapsed={false} workspaces={[]} onAddWorkspace={handleAdd} />
    );

    const addBtn = screen.getByRole('button', { name: 'Tambah workspace' });
    await user.click(addBtn);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });
});
