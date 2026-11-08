import { FiChevronsLeft, FiX } from 'react-icons/fi';
import {
  buildNavigation,
  searchNavigation,
  type NavigationSectionConfig
} from '@/app/navigation/navigation';
import { NavigationItem } from '@/components/layout/navigation-item/navigation-item';
import { NavigationSection } from '@/components/layout/navigation-section/navigation-section';
import { IconButton } from '@/components/ui/icon-button/icon-button';
import { joinClasses } from '@/core/utils/join-classes';

export function SecondarySidebar({
  workspaceId,
  collapsed,
  showCollapse,
  onToggleCollapse,
  onClose,
  sections
}: {
  workspaceId?: string | undefined;
  collapsed: boolean;
  showCollapse?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  sections?: readonly NavigationSectionConfig[];
}) {
  const navigation = sections ?? buildNavigation(workspaceId);
  const search = searchNavigation();

  return (
    <div className={joinClasses('secondary-sidebar', collapsed && 'secondary-sidebar--collapsed')}>
      <header className="secondary-sidebar__header">
        <nav aria-label="Pencarian">
          <ul className="nav-section__list">
            <NavigationItem item={search} collapsed={collapsed} />
          </ul>
        </nav>
        {onClose ? (
          <IconButton label="Tutup navigasi" onClick={onClose}>
            <FiX />
          </IconButton>
        ) : null}
        {showCollapse ? (
          <IconButton
            label={collapsed ? 'Bentangkan navigasi' : 'Ciutkan navigasi'}
            aria-expanded={!collapsed}
            aria-controls="secondary-sidebar"
            onClick={onToggleCollapse}
            className={joinClasses('sidebar-toggle', collapsed && 'sidebar-toggle--collapsed')}
          >
            <span
              className={joinClasses('collapse-chevron', collapsed && 'collapse-chevron--rotated')}
            >
              <FiChevronsLeft />
            </span>
          </IconButton>
        ) : null}
      </header>
      <nav className="secondary-sidebar__scroll scroll-area" aria-label="Navigasi aplikasi">
        {navigation.map((section) => (
          <NavigationSection key={section.id} section={section} collapsed={collapsed} />
        ))}
      </nav>
    </div>
  );
}
