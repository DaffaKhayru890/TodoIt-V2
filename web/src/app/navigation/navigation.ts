import type { IconType } from 'react-icons';
import {
  FiBookmark,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiInbox,
  FiList,
  FiSearch,
  FiSettings,
  FiTag
} from 'react-icons/fi';
import { paths } from '@/app/router/route-paths';

export interface NavigationItemConfig {
  id: string;
  label: string;
  href: string;
  icon: IconType;
  end?: boolean;
}

export interface NavigationSectionConfig {
  id: string;
  title: string;
  items: readonly NavigationItemConfig[];
}

export function searchNavigation(): NavigationItemConfig {
  return { id: 'search', label: 'Cari', href: paths.search, icon: FiSearch };
}

export function buildNavigation(workspaceId?: string): readonly NavigationSectionConfig[] {
  const generalItems: NavigationItemConfig[] = [
    { id: 'inbox', label: 'Inbox', href: paths.inbox, icon: FiInbox }
  ];

  const sections: NavigationSectionConfig[] = [];

  if (workspaceId) {
    generalItems.push(
      { id: 'today', label: 'Today', href: paths.today(workspaceId), icon: FiCalendar },
      { id: 'upcoming', label: 'Upcoming', href: paths.upcoming(workspaceId), icon: FiClock }
    );
  }

  sections.push({ id: 'general', title: 'General', items: generalItems });

  if (workspaceId) {
    sections.push({
      id: 'workspace',
      title: 'Workspace',
      items: [
        {
          id: 'all-tasks',
          label: 'All Tasks',
          href: paths.workspace(workspaceId),
          icon: FiList,
          end: true
        },
        {
          id: 'completed',
          label: 'Completed',
          href: paths.completed(workspaceId),
          icon: FiCheckCircle
        },
        { id: 'tags', label: 'Tags', href: paths.tags(workspaceId), icon: FiTag },
        { id: 'labels', label: 'Labels', href: paths.labels(workspaceId), icon: FiBookmark }
      ]
    });
  }

  sections.push({
    id: 'preferences',
    title: 'Preferences',
    items: [{ id: 'settings', label: 'Settings', href: paths.settings, icon: FiSettings }]
  });

  return sections;
}
