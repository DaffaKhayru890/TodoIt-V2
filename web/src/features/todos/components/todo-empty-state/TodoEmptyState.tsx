import { FiPlus } from 'react-icons/fi';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { Button } from '@/components/ui/button/button';

export interface TodoEmptyStateProps {
  readonly onCreate: () => void;
  readonly disabled?: boolean;
}

function TodoIllustration() {
  return (
    <svg viewBox="0 0 180 130" role="img" aria-label="Ilustrasi daftar tugas kosong">
      <rect
        x="12"
        y="10"
        width="156"
        height="110"
        fill="#ffffff"
        stroke="#171717"
        strokeWidth="3"
      />
      <rect x="28" y="26" width="84" height="14" fill="#ffe14a" stroke="#171717" strokeWidth="3" />
      <rect x="28" y="52" width="18" height="18" fill="#ffffff" stroke="#171717" strokeWidth="3" />
      <rect x="56" y="56" width="84" height="10" fill="#ddd6fe" stroke="#171717" strokeWidth="3" />
      <rect x="28" y="82" width="18" height="18" fill="#ffffff" stroke="#171717" strokeWidth="3" />
      <rect x="56" y="86" width="62" height="10" fill="#fffdf8" stroke="#171717" strokeWidth="3" />
      <path d="M32 91 37 96 48 83" fill="none" stroke="#171717" strokeWidth="3" />
    </svg>
  );
}

export function TodoEmptyState({ onCreate, disabled = false }: TodoEmptyStateProps) {
  return (
    <div className="todo-empty">
      <EmptyState
        title="Belum ada tugas!"
        description="Mulai dengan membuat task pertamamu dan atur pekerjaanmu di workspace ini."
        illustration={<TodoIllustration />}
        action={
          <Button
            type="button"
            variant="primary"
            leadingIcon={<FiPlus aria-hidden="true" />}
            disabled={disabled}
            onClick={onCreate}
          >
            Buat tugas pertama
          </Button>
        }
      />
    </div>
  );
}
