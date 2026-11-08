import { render, screen } from '@testing-library/react';
import type { FieldErrors } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { describe, expect, test } from 'vitest';
import type { TodoFormValues } from '../../schemas/todo-fields.schema';
import { TodoFormFields } from './TodoFormFields';

function Harness({
  errors,
  disabled = false
}: {
  readonly errors: FieldErrors<TodoFormValues>;
  readonly disabled?: boolean;
}) {
  const { register } = useForm<TodoFormValues>({
    defaultValues: { title: '', description: '' }
  });

  return <TodoFormFields register={register} errors={errors} disabled={disabled} />;
}

describe('TodoFormFields', () => {
  test('merender input judul dan textarea deskripsi dengan batas backend', () => {
    render(<Harness errors={{}} />);

    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText(/Deskripsi/i)).toHaveAttribute('maxlength', '5000');
    expect(screen.getByText('Maksimal 5000 karakter')).toBeInTheDocument();
  });

  test('menampilkan error per field', () => {
    render(
      <Harness
        errors={{
          title: { type: 'manual', message: 'Judul ditolak.' },
          description: { type: 'manual', message: 'Deskripsi ditolak.' }
        }}
      />
    );

    expect(screen.getByText('Judul ditolak.')).toBeInTheDocument();
    expect(screen.getByText('Deskripsi ditolak.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveAttribute('aria-invalid', 'true');
  });

  test('menonaktifkan field ketika proses berjalan', () => {
    render(<Harness errors={{}} disabled />);

    expect(screen.getByLabelText(/Judul Tugas/i)).toBeDisabled();
    expect(screen.getByLabelText(/Deskripsi/i)).toBeDisabled();
  });
});
