import { useMemo, useState } from 'react';

/**
 * Image from /assets with fallback chain (does not silently vanish).
 * Default styles keep img vertically centered beside text in flex rows.
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
    return [...new Set(list.map(String))];
  }, [src, fallbacks]);

  const [idx, setIdx] = useState(0);
  const current = sources[Math.min(idx, Math.max(sources.length - 1, 0))] || '';

  const base = {
    display: 'block',
    objectFit: 'contain',
    flexShrink: 0,
    alignSelf: 'center',
    verticalAlign: 'middle',
  };
  const s = size
    ? { ...base, width: size, height: size, ...style }
    : { ...base, ...style };

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
          background: 'rgba(0, 0, 0, 0.06)',
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
      className={`asset-img ${className}`.trim()}
      style={s}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
