/** Simple loading placeholders */

export function SkeletonLine({ width = '100%', height = 12, className = '' }) {
  return (
    <span
      className={`skeleton-line ${className}`.trim()}
      style={{ width, height }}
      aria-hidden
    />
  );
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-card item-card ${className}`.trim()} aria-hidden>
      <div className="skeleton-card-header">
        <SkeletonLine width={36} height={36} className="skeleton-avatar" />
        <SkeletonLine width="40%" height={14} />
      </div>
      <div className="skeleton-card-body">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} width={i === lines - 1 ? '55%' : '100%'} height={12} />
        ))}
      </div>
    </div>
  );
}

/** Profile page layout skeleton */
export function ProfileSkeleton() {
  return (
    <div className="page-skeleton profile-skeleton" aria-busy="true" aria-label="Loading profile">
      <div className="skeleton-card item-card">
        <div className="skeleton-card-header" style={{ gap: 16 }}>
          <SkeletonLine width={72} height={72} className="skeleton-avatar skeleton-avatar-lg" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine width="50%" height={18} />
            <SkeletonLine width="35%" height={12} />
            <SkeletonLine width="45%" height={12} />
          </div>
        </div>
        <div className="skeleton-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonLine key={i} height={48} />
          ))}
        </div>
      </div>
      <SkeletonCard lines={6} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}

/** Vault grid skeleton */
export function VaultSkeleton() {
  return (
    <div className="page-skeleton vault-skeleton" aria-busy="true" aria-label="Loading vault">
      <SkeletonLine width="30%" height={22} />
      <SkeletonLine width="55%" height={12} />
      <div className="vault-skeleton-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton-card item-card vault-skeleton-cell">
            <SkeletonLine width={40} height={40} className="skeleton-avatar" />
            <SkeletonLine width="70%" height={12} />
            <SkeletonLine width="100%" height={32} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic page skeleton (calculator pages) */
export function PageSkeleton({ cards = 3 }) {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading page">
      <SkeletonCard lines={2} />
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} lines={4} />
      ))}
    </div>
  );
}
