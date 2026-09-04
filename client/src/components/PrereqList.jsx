/**
 * Shows unmet prerequisites only (buildings / war academy / masters).
 * items: { raw, name, level, have, met, tracked, detail? }
 */
export default function PrereqList({ items = [] }) {
  const unmet = (items || []).filter((it) => it && !it.met);
  if (!unmet.length) return null;

  return (
    <div className="prereq-list" style={{ marginTop: 8, marginBottom: 6 }}>
      <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, opacity: 0.9 }}>
        Prerequisites
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', lineHeight: 1.45 }}>
        {unmet.map((it) => {
          const key = it.raw || `${it.name}-${it.level}`;
          let status;
          let color;
          if (!it.tracked) {
            status = 'not tracked on this site';
            color = '#888';
          } else if (it.detail) {
            status = it.detail;
            color = '#c0392b';
          } else if (it.have != null && it.have !== '') {
            // Requirement is already in `raw` (e.g. "Acquaintance 3") — only show current
            status = `current: ${it.have}`;
            color = '#c0392b';
          } else {
            status = 'not met';
            color = '#c0392b';
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
