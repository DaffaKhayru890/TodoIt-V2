import { useRef, useState } from 'react';
import { FiMenu } from 'react-icons/fi';
import { useLocation, useParams } from 'react-router';
import { buildNavigation } from '@/app/navigation/navigation';
import { workspaceFixtures } from '@/app/navigation/workspace-fixtures';
import {
  readSidebarPreference,
  writeSidebarPreference,
  type SidebarPreference
} from '@/app/shell/sidebar-preference';
import { MainContent } from '@/components/layout/main-content/main-content';
import { MobileNavigationDrawer } from '@/components/layout/mobile-navigation/mobile-navigation-drawer';
import { PrimarySidebar } from '@/components/layout/primary-sidebar/primary-sidebar';
import { SecondarySidebar } from '@/components/layout/secondary-sidebar/secondary-sidebar';
import { IconButton } from '@/components/ui/icon-button/icon-button';
import { joinClasses } from '@/core/utils/join-classes';
import { useDialogBehavior } from '@/hooks/use-dialog-behavior';
import { useMediaQuery } from '@/hooks/use-media-query';

const compactQuery = '(max-width: 1023px)';

export function AppLayout() {
  const compact = useMediaQuery(compactQuery);
  const [preference, setPreference] = useState<SidebarPreference>(readSidebarPreference);
  const [drawer, setDrawer] = useState<'none' | 'primary' | 'secondary'>('none');
  const [trackedCompact, setTrackedCompact] = useState(compact);

  if (compact !== trackedCompact) {
    setTrackedCompact(compact);
    if (!compact) {
      setDrawer('none');
    }
  }
  const location = useLocation();
  const [trackedPath, setTrackedPath] = useState(location.pathname);
  const { workspaceId } = useParams();

  if (location.pathname !== trackedPath) {
    setTrackedPath(location.pathname);
    setDrawer('none');
  }
  const known = workspaceFixtures.find((item) => item.id === workspaceId);
  const activeWorkspaceId = known?.id ?? workspaceFixtures[0]?.id ?? '';
  const primaryRef = useRef<HTMLDivElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const drawerOpen = compact && drawer !== 'none';

  useDialogBehavior(
    drawerOpen,
    () => setDrawer('none'),
    drawer === 'secondary' ? secondaryRef : primaryRef
  );

  function toggle(side: 'primary' | 'secondary') {
    setPreference((current) => {
      const next = {
        primaryCollapsed: side === 'primary' ? !current.primaryCollapsed : current.primaryCollapsed,
        secondaryCollapsed:
          side === 'secondary' ? !current.secondaryCollapsed : current.secondaryCollapsed
      };
      writeSidebarPreference(next);
      return next;
    });
  }

  const primaryCollapsed = !compact && preference.primaryCollapsed;
  const secondaryCollapsed = !compact && preference.secondaryCollapsed;
  const closeDrawer = () => setDrawer('none');

  return (
    <div
      className={joinClasses(
        'app-layout',
        primaryCollapsed && 'app-layout--primary-collapsed',
        secondaryCollapsed && 'app-layout--secondary-collapsed'
      )}
    >
      <a className="skip-link" href="#main-content">
        Loncat ke konten
      </a>
      {compact ? (
        <header className="app-layout__bar">
          <IconButton
            label="Buka workspace"
            aria-expanded={drawer === 'primary'}
            aria-controls="primary-sidebar"
            onClick={() => setDrawer('primary')}
          >
            <FiMenu />
          </IconButton>
          <span className="app-layout__title">TodoIt</span>
          <IconButton
            label="Buka navigasi"
            aria-expanded={drawer === 'secondary'}
            aria-controls="secondary-sidebar"
            onClick={() => setDrawer('secondary')}
          >
            <FiMenu />
          </IconButton>
        </header>
      ) : null}
      {drawerOpen ? <MobileNavigationDrawer onClose={closeDrawer} /> : null}
      <div
        id="primary-sidebar"
        ref={primaryRef}
        hidden={compact && drawer !== 'primary'}
        role={compact && drawer === 'primary' ? 'dialog' : undefined}
        aria-modal={compact && drawer === 'primary' ? true : undefined}
        aria-label={compact && drawer === 'primary' ? 'Workspace' : undefined}
      >
        <PrimarySidebar
          collapsed={primaryCollapsed}
          workspaces={workspaceFixtures}
          showCollapse={!compact}
          onToggleCollapse={() => toggle('primary')}
          {...(compact ? { onClose: closeDrawer } : {})}
        />
      </div>
      <div
        id="secondary-sidebar"
        ref={secondaryRef}
        hidden={compact && drawer !== 'secondary'}
        role={compact && drawer === 'secondary' ? 'dialog' : undefined}
        aria-modal={compact && drawer === 'secondary' ? true : undefined}
        aria-label={compact && drawer === 'secondary' ? 'Navigasi aplikasi' : undefined}
      >
        <SecondarySidebar
          workspaceId={activeWorkspaceId}
          sections={buildNavigation(activeWorkspaceId)}
          collapsed={secondaryCollapsed}
          showCollapse={!compact}
          onToggleCollapse={() => toggle('secondary')}
          {...(compact ? { onClose: closeDrawer } : {})}
        />
      </div>
      <MainContent />
    </div>
  );
}
