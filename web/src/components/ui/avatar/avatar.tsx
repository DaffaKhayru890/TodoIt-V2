import { useState } from 'react';
import { joinClasses } from '@/core/utils/join-classes';

type AvatarSize = 'small' | 'medium' | 'large';
type AvatarTone = 'primary' | 'secondary' | 'accent';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({
  name,
  src,
  size = 'medium',
  tone = 'primary'
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span className={joinClasses('avatar', `avatar--${size}`, `avatar--${tone}`)}>
      {showImage ? (
        <img className="avatar__image" src={src} alt={name} onError={() => setFailed(true)} />
      ) : (
        <span aria-label={name} role="img">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
