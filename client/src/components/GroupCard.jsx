import AssetImg from './AssetImg';

/**
 * Large group container used across pages (War Academy, Gov Gear/Charm, Troops, …)
 */
export default function GroupCard({
  title,
  iconSrc,
  iconAlt = '',
  headerExtra = null,
  children,
  className = '',
  bodyClassName = '',
}) {
  return (
    <div className={`group-card ${className}`.trim()}>
      <div className="group-card-header">
        {iconSrc ? <AssetImg src={iconSrc} size={32} alt={iconAlt || title} /> : null}
        <span className="group-card-title">{title}</span>
        {headerExtra}
      </div>
      <div className={`group-card-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
}
