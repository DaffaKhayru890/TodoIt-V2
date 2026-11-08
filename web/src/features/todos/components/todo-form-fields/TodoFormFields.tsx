import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea/textarea';
import type { TodoFormValues } from '../../schemas/todo-fields.schema';

export interface TodoFormFieldsProps {
  readonly register: UseFormRegister<TodoFormValues>;
  readonly errors: FieldErrors<TodoFormValues>;
  readonly disabled?: boolean;
}

/**
 * Field dasar Todo dipakai bersama oleh Create dan Edit agar aturan validasi,
 * label, dan batas panjang tidak menyimpang antar dialog.
 */
export function TodoFormFields({ register, errors, disabled = false }: TodoFormFieldsProps) {
  return (
    <div className="todo-form__fields">
      <Input
        label="Judul Tugas"
        required
        maxLength={200}
        placeholder="contoh: Menyusun rencana sprint"
        error={errors.title?.message}
        disabled={disabled}
        {...register('title')}
      />

      <Textarea
        label="Deskripsi (opsional)"
        hint="Maksimal 5000 karakter"
        rows={4}
        maxLength={5000}
        placeholder="Tambahkan konteks atau langkah yang perlu dilakukan..."
        error={errors.description?.message}
        disabled={disabled}
        {...register('description')}
      />
    </div>
  );
}
