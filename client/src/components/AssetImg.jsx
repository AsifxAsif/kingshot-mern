import { useMemo, useState } from 'react';

/**
 * Image from /assets with fallback chain (does not silently vanish).
 */
export default function AssetImg({
  src,
  fallbacks = [],
  alt = '',
  className = '',
  style = {},
  size,
  placeholder = true,
}) {
  const sources = useMemo(() => {
    const list = [src, ...(fallbacks || [])].filter(Boolean);
    // unique
    return [...new Set(list.map(String))];
  }, [src, fallbacks]);

  const [idx, setIdx] = useState(0);
  const current = sources[Math.min(idx, Math.max(sources.length - 1, 0))] || '';

  const s = size
    ? { width: size, height: size, objectFit: 'contain', flexShrink: 0, ...style }
    : { objectFit: 'contain', ...style };

  if (!current || idx >= sources.length) {
    if (!placeholder) return null;
    return (
      <span
        className={`asset-img-fallback ${className}`}
        style={{
          ...s,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.06)',
          borderRadius: 6,
          fontSize: Math.max(10, (size || 24) * 0.35),
          color: '#666',
          textAlign: 'center',
          lineHeight: 1.1,
          padding: 2,
        }}
        title={alt || 'missing image'}
      >
        {alt ? String(alt).slice(0, 3).toUpperCase() : '?'}
      </span>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      style={s}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
