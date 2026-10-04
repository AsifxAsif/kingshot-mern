/** Loading placeholders that mirror real page / card layouts */

export function SkeletonLine({ width = '100%', height = 12, className = '', style = {} }) {
  return (
    <span
      className={`skeleton-line ${className}`.trim()}
      style={{ width, height, ...style }}
      aria-hidden
    />
  );
}

/** One item-card shaped block (header + body rows) — matches Buildings / Masters cards */
export function SkeletonCard({ lines = 3, className = '', showChecks = true }) {
  return (
    <div className={`skeleton-card item-card ${className}`.trim()} aria-hidden>
      <div className="skeleton-card-header item-card-header">
        <SkeletonLine width={44} height={44} className="skeleton-avatar" />
        <div className="skeleton-card-title-col">
          <SkeletonLine width="55%" height={14} />
          <SkeletonLine width="35%" height={10} style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="skeleton-card-body item-card-body">
        <div className="skeleton-level-row">
          <SkeletonLine width={72} height={12} />
          <SkeletonLine width="100%" height={34} className="skeleton-input" />
        </div>
        <div className="skeleton-level-row">
          <SkeletonLine width={56} height={12} />
          <SkeletonLine width="100%" height={34} className="skeleton-input" />
        </div>
        {showChecks ? (
          <div className="skeleton-check-row">
            <SkeletonLine width={96} height={18} />
            <SkeletonLine width={110} height={18} />
          </div>
        ) : null}
        {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 3 ? '48%' : '100%'}
            height={11}
            style={{ marginTop: 8 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Options / buff bar strip above grids */
function SkeletonOptionsBar() {
  return (
    <div className="skeleton-options-bar" aria-hidden>
      <SkeletonLine width={140} height={28} className="skeleton-chip" />
      <SkeletonLine width={180} height={28} className="skeleton-chip" />
      <SkeletonLine width={120} height={28} className="skeleton-chip" />
    </div>
  );
}

/** Profile page layout skeleton */
export function ProfileSkeleton() {
  return (
    <div className="page-skeleton profile-skeleton" aria-busy="true" aria-label="Loading profile">
      <div className="skeleton-card item-card">
        <div className="skeleton-card-header item-card-header" style={{ gap: 16 }}>
          <SkeletonLine width={72} height={72} className="skeleton-avatar skeleton-avatar-lg" />
          <div className="skeleton-card-title-col" style={{ flex: 1 }}>
            <SkeletonLine width="50%" height={18} />
            <SkeletonLine width="35%" height={12} style={{ marginTop: 8 }} />
            <SkeletonLine width="45%" height={12} style={{ marginTop: 8 }} />
          </div>
        </div>
        <div
          className="skeleton-card-body item-card-body"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
        >
          {[1, 2, 3].map((i) => (
            <SkeletonLine key={i} height={48} className="skeleton-input" />
          ))}
        </div>
      </div>
      <SkeletonCard lines={4} showChecks={false} />
      <div className="skeleton-grid skeleton-grid-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} lines={3} showChecks={false} />
        ))}
      </div>
    </div>
  );
}

/** Vault grid skeleton */
export function VaultSkeleton() {
  return (
    <div className="page-skeleton vault-skeleton" aria-busy="true" aria-label="Loading vault">
      <SkeletonLine width="28%" height={22} className="skeleton-heading" />
      <SkeletonLine width="52%" height={12} style={{ marginBottom: 12 }} />
      <div className="vault-skeleton-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton-card item-card vault-skeleton-cell">
            <SkeletonLine width={40} height={40} className="skeleton-avatar" />
            <SkeletonLine width="72%" height={12} />
            <SkeletonLine width="100%" height={34} className="skeleton-input" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Generic calculator page skeleton — options bar + item-card grid
 * (Buildings, War Academy, Masters, Heroes, etc.)
 */
export function PageSkeleton({ cards = 6, label = 'Loading page' }) {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label={label}>
      <SkeletonOptionsBar />
      <div className="skeleton-grid skeleton-grid-cards">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    </div>
  );
}

/** Masters-style: inventory strip + grouped cards */
export function MastersSkeleton() {
  return (
    <div className="page-skeleton masters-skeleton" aria-busy="true" aria-label="Loading masters">
      <SkeletonOptionsBar />
      <div className="skeleton-card item-card" style={{ marginBottom: 12 }}>
        <div className="skeleton-card-header item-card-header">
          <SkeletonLine width="40%" height={14} />
        </div>
        <div
          className="skeleton-card-body item-card-body"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLine key={i} width={88} height={56} className="skeleton-chip" />
          ))}
        </div>
      </div>
      <div className="skeleton-grid skeleton-grid-cards">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}
