import type { NavigationSectionConfig } from '@/app/navigation/navigation';
import { NavigationItem } from '@/components/layout/navigation-item/navigation-item';
import { joinClasses } from '@/core/utils/join-classes';

export function NavigationSection({
  section,
  collapsed
}: {
  section: NavigationSectionConfig;
  collapsed: boolean;
}) {
  return (
    <section className="nav-section" aria-labelledby={`${section.id}-title`}>
      <h2
        id={`${section.id}-title`}
        className={joinClasses('nav-section__title', collapsed && 'visually-hidden')}
      >
        {section.title}
      </h2>
      <ul className="nav-section__list">
        {section.items.map((item) => (
          <NavigationItem key={item.id} item={item} collapsed={collapsed} />
        ))}
      </ul>
    </section>
  );
}
