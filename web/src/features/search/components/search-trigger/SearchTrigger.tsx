import { FiSearch } from 'react-icons/fi';
import { Tooltip } from '@/components/ui/tooltip/tooltip';
import { joinClasses } from '@/core/utils/join-classes';

export function SearchTrigger({ collapsed, onOpen }: { collapsed: boolean; onOpen: () => void }) {
  const button = (
    <button
      type="button"
      className={joinClasses('nav-item', 'search-trigger')}
      aria-label="Cari di TodoIt"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={onOpen}
    >
      <span className="nav-item__icon" aria-hidden="true">
        <FiSearch />
      </span>
      <span className={joinClasses('nav-item__label', collapsed && 'visually-hidden')}>Cari</span>
      {!collapsed ? (
        <kbd className="search-trigger__shortcut" aria-hidden="true">
          Ctrl K
        </kbd>
      ) : null}
    </button>
  );

  return <li>{collapsed ? <Tooltip label="Cari (Ctrl+K)">{button}</Tooltip> : button}</li>;
}
