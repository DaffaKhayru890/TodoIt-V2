import { Modal } from '@/components/ui/modal/modal';
import { SearchContent } from '../search-content/SearchContent';

export function SearchPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Cari di TodoIt" onClose={onClose} className="modal--search">
      <SearchContent autoFocus onClose={onClose} />
    </Modal>
  );
}
