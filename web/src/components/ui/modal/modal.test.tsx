import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Modal } from '@/components/ui/modal/modal';

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Buka dialog
      </button>
      <Modal open={open} title="Konfirmasi" onClose={() => setOpen(false)}>
        <p>Isi dialog</p>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  test('menjaga fokus, menutup dengan Escape, dan mengembalikan fokus', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Buka dialog' }));
    const dialog = screen.getByRole('dialog', { name: 'Konfirmasi' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tutup' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka dialog' })).toHaveFocus();
  });

  test('backdrop menutup dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Buka dialog' }));
    await user.click(screen.getByRole('button', { name: 'Tutup dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
