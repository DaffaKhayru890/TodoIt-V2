import { Button } from '@/components/ui/button/button';

export interface DiscardChangesProps {
  readonly onKeepEditing: () => void;
  readonly onDiscard: () => void;
  readonly busy?: boolean;
}

export function DiscardChanges({ onKeepEditing, onDiscard, busy = false }: DiscardChangesProps) {
  return (
    <div className="workspace-dialog-form" data-testid="discard-changes">
      <p>Perubahan belum disimpan. Yakin ingin menutup formulir ini?</p>
      <p className="field__hint">
        Semua isian yang sudah kamu ubah akan hilang jika formulir ditutup.
      </p>

      <div className="workspace-dialog-form__actions">
        <Button type="button" variant="outline" disabled={busy} onClick={onKeepEditing}>
          Lanjutkan Mengedit
        </Button>
        <Button type="button" variant="danger" disabled={busy} onClick={onDiscard}>
          Buang Perubahan
        </Button>
      </div>
    </div>
  );
}
