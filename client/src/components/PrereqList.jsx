/**
 * Shows prerequisite upgrades for a path (buildings / war academy).
 * items: from evaluateRequirements().items
 */
export default function PrereqList({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="prereq-list" style={{ marginTop: 8, marginBottom: 6 }}>
      <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, opacity: 0.9 }}>
        Prerequisites
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', lineHeight: 1.45 }}>
        {items.map((it) => {
          const key = it.raw || `${it.name}-${it.level}`;
          let status;
          let color;
          if (!it.tracked) {
            status = 'not tracked on this site';
            color = '#888';
          } else if (it.met) {
            status = it.have != null ? `have ${it.have}` : 'met';
            color = '#2e7d32';
          } else {
            status = it.have != null ? `have ${it.have} — need ${it.level}` : `need ${it.level}`;
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
