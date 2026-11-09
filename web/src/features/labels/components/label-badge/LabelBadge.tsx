import { joinClasses } from '@/core/utils/join-classes';
import { getLabelTextColor } from '../../models/label.mapper';

export interface LabelBadgeProps {
  readonly name: string;
  readonly color: string;
  readonly className?: string;
}

export function LabelBadge({ name, color, className }: LabelBadgeProps) {
  return (
    <span
      className={joinClasses('label-badge', className)}
      style={{ backgroundColor: color, color: getLabelTextColor(color) }}
    >
      {name}
    </span>
  );
}
