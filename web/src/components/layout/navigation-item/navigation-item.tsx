import { NavLink } from 'react-router';
import type { NavigationItemConfig } from '@/app/navigation/navigation';
import { Tooltip } from '@/components/ui/tooltip/tooltip';
import { joinClasses } from '@/core/utils/join-classes';

export function NavigationItem({
  item,
  collapsed
}: {
  item: NavigationItemConfig;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.href}
      end={item.end ?? false}
      className={({ isActive }) => joinClasses('nav-item', isActive && 'nav-item--active')}
    >
      <span className="nav-item__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className={joinClasses('nav-item__label', collapsed && 'visually-hidden')}>
        {item.label}
      </span>
    </NavLink>
  );

  return <li>{collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link}</li>;
}
