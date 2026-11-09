export interface ProductivityEmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly variant: 'today' | 'upcoming';
}

function EmptyIllustration({ variant }: { readonly variant: 'today' | 'upcoming' }) {
  const accent = variant === 'today' ? '#ffe14a' : '#ddd6fe';

  return (
    <svg viewBox="0 0 200 140" role="img" aria-label="Ilustrasi tidak ada tugas">
      <rect x="18" y="12" width="164" height="116" fill="#ffffff" stroke="#171717" strokeWidth="3" />
      <rect x="34" y="28" width="92" height="16" fill={accent} stroke="#171717" strokeWidth="3" />
      <rect x="34" y="58" width="22" height="22" fill="#ffffff" stroke="#171717" strokeWidth="3" />
      <path d="M39 69 45 75 57 60" fill="none" stroke="#171717" strokeWidth="3" />
      <rect x="68" y="63" width="94" height="12" fill="#f5f5f5" stroke="#171717" strokeWidth="3" />
      <rect x="34" y="92" width="22" height="22" fill="#ffffff" stroke="#171717" strokeWidth="3" />
      <rect x="68" y="97" width="70" height="12" fill="#f5f5f5" stroke="#171717" strokeWidth="3" />
      {variant === 'upcoming' ? (
        <circle cx="158" cy="104" r="20" fill={accent} stroke="#171717" strokeWidth="3" />
      ) : (
        <path d="M140 92 160 104 140 116Z" fill={accent} stroke="#171717" strokeWidth="3" />
      )}
    </svg>
  );
}

export function ProductivityEmptyState({
  title,
  description,
  variant
}: ProductivityEmptyStateProps) {
  return (
    <section className="productivity-empty" aria-live="polite">
      <div className="productivity-empty__illustration">
        <EmptyIllustration variant={variant} />
      </div>
      <div className="productivity-empty__copy">
        <h2 className="productivity-empty__title">{title}</h2>
        <p className="productivity-empty__description">{description}</p>
      </div>
    </section>
  );
}
