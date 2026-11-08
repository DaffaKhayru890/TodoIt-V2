import { useRef, useState } from 'react';
import { FiMenu } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router';
import { buildNavigation } from '@/app/navigation/navigation';
import { paths } from '@/app/router/route-paths';
import { readSidebarPreference } from '@/app/shell/sidebar-preference';
import { MainContent } from '@/components/layout/main-content/main-content';
import { MobileNavigationDrawer } from '@/components/layout/mobile-navigation/mobile-navigation-drawer';
import { PrimarySidebar } from '@/components/layout/primary-sidebar/primary-sidebar';
import { SecondarySidebar } from '@/components/layout/secondary-sidebar/secondary-sidebar';
import { IconButton } from '@/components/ui/icon-button/icon-button';
import { joinClasses } from '@/core/utils/join-classes';
import { CreateWorkspaceDialog } from '@/features/workspaces/components/create-workspace-dialog/CreateWorkspaceDialog';
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces';
import { useDialogBehavior } from '@/hooks/use-dialog-behavior';
import { useMediaQuery } from '@/hooks/use-media-query';

const compactQuery = '(max-width: 1023px)';

export function AppLayout() {
  const compact = useMediaQuery(compactQuery);
  const preference = readSidebarPreference();
  const [drawer, setDrawer] = useState<'none' | 'primary' | 'secondary'>('none');
  const [trackedCompact, setTrackedCompact] = useState(compact);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const navigate = useNavigate();

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

  const {
    data: workspacesData,
    isLoading: workspacesLoading,
    isError: workspacesError,
    refetch: refetchWorkspaces
  } = useWorkspaces({ limit: 50 });

  const workspaces = workspacesData?.items ?? [];

  // URL adalah sumber utama workspace aktif. Fallback ke workspace pertama
  // hanya dipakai ketika pengguna berada di luar rute workspace.
  const activeWorkspaceId = workspaceId ?? workspaces[0]?.id ?? '';

  const primaryRef = useRef<HTMLDivElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const drawerOpen = compact && drawer !== 'none';

  useDialogBehavior(
    drawerOpen,
    () => setDrawer('none'),
    drawer === 'secondary' ? secondaryRef : primaryRef
  );

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
          workspaces={workspaces}
          isLoading={workspacesLoading}
          isError={workspacesError}
          onRetry={() => refetchWorkspaces()}
          onAddWorkspace={() => setIsCreateOpen(true)}
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
          workspaceId={activeWorkspaceId || undefined}
          sections={buildNavigation(activeWorkspaceId || undefined)}
          collapsed={secondaryCollapsed}
          {...(compact ? { onClose: closeDrawer } : {})}
        />
      </div>
      <MainContent />

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(created) => {
          navigate(paths.workspace(created.id));
        }}
      />
    </div>
  );
}
