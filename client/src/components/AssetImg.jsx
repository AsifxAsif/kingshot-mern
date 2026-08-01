/**
 * Lazy image from /assets with graceful hide on missing file
 */
export default function AssetImg({ src, alt = '', className = '', style = {}, size }) {
  const s = size
    ? { width: size, height: size, objectFit: 'contain', flexShrink: 0, ...style }
    : { objectFit: 'contain', ...style };

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={s}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
