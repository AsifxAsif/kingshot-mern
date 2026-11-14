/**
 * Shows skill / building / war-academy prerequisites.
 * items: { raw, name, level, have, met, tracked, detail? }
 * warnOnly: amber styling when prerequisite check is off (does not block Upgrade)
 * showAll: list met and unmet (default: unmet only)
 */
export default function PrereqList({ items = [], warnOnly = false, showAll = false }) {
  const list = (items || []).filter((it) => {
    if (!it) return false;
    if (showAll) return true;
    return !it.met;
  });
  if (!list.length) return null;

  const titleColor = warnOnly ? '#b8860b' : undefined;
  const unmetColor = warnOnly ? '#b8860b' : '#c0392b';
  const metColor = '#2e7d32';

  return (
    <div className="prereq-list" style={{ marginTop: 8, marginBottom: 6 }}>
      <div
        style={{
          fontWeight: 600,
          fontSize: '0.8rem',
          marginBottom: 4,
          opacity: 0.9,
          color: titleColor,
        }}
      >
        {warnOnly ? 'Prerequisites (not enforced)' : 'Prerequisites'}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', lineHeight: 1.45 }}>
        {list.map((it) => {
          const key = it.raw || `${it.name}-${it.level}`;
          const isMet = !!it.met;
          let status;
          let color;
          if (!it.tracked) {
            status = 'not tracked on this site';
            color = '#888';
          } else if (isMet) {
            status = 'met';
            color = metColor;
          } else if (it.detail) {
            status = it.detail;
            color = unmetColor;
          } else if (it.have != null && it.have !== '') {
            status = `current: ${it.have}`;
            color = unmetColor;
          } else {
            status = 'not met';
            color = unmetColor;
          }
          return (
            <li key={key} style={{ color }}>
              <span style={{ color: 'inherit' }}>{it.raw}</span>
              <span style={{ opacity: 0.85 }}> ({status})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
