import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { formatNumber } from '../utils/calc';

const SECTIONS = [
  { key: 'buildings', title: 'Buildings', path: '/buildings', scoreKey: 'buildings' },
  { key: 'troops', title: 'Troops', path: '/troops', scoreKey: 'troops' },
  { key: 'warAcademy', title: 'War Academy', path: '/war-academy', scoreKey: 'warAcademy' },
  { key: 'heroes', title: 'Heroes', path: '/heroes', scoreKey: 'heroes' },
  { key: 'heroGear', title: 'Hero Gear', path: '/hero-gear', scoreKey: 'heroGear' },
  { key: 'govGear', title: 'Gov Gear', path: '/gov-gear', scoreKey: 'govGear' },
  { key: 'govCharm', title: 'Gov Charm', path: '/gov-charm', scoreKey: 'govCharm' },
  { key: 'widgets', title: 'Widgets', path: '/widgets', scoreKey: 'widgets' },
  { key: 'pets', title: 'Pets', path: '/pets', scoreKey: 'pets' },
  { key: 'misc', title: 'Misc', path: '/misc', scoreKey: 'misc' },
];

function str(v) {
  if (v == null || v === '') return null;
  return String(v);
}

/** True only when there is a real level range to upgrade */
function hasUpgradeRange(from, to) {
  const a = str(from);
  const b = str(to);
  if (a == null || b == null) return false;
  if (a === b) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return nb > na;
  return true; // non-numeric level names still count if both set and different
}

function levelLabel(from, to) {
  return `${str(from) ?? '—'} → ${str(to) ?? '—'}`;
}

/**
 * Build preview rows. ACTIVE only when:
 *  - the page would treat it as a real selection (levels / qty / etc.)
 *  - AND the user checked Active/Upgrade on that card
 * Never invent items that aren't on the calculator pages.
 */
function collectRows(key, state) {
  const rows = [];

  if (key === 'buildings' || key === 'warAcademy' || key === 'govGear' || key === 'govCharm' || key === 'pets' || key === 'widgets') {
    const section = state[key] || {};
    for (const [name, s] of Object.entries(section)) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
      if (!hasUpgradeRange(s.from, s.to)) continue; // no real selection → skip entirely
      const parts = [levelLabel(s.from, s.to)];
      if (s.speedup) parts.push('+Speedups');
      rows.push({
        id: name,
        name,
        detail: parts.join(' · '),
        active: !!s.active, // only flag active if checkbox set; still requires range above
      });
    }
    return rows;
  }

  if (key === 'troops') {
    const section = state.troops || {};
    for (const [id, s] of Object.entries(section)) {
      if (!s || typeof s !== 'object') continue;

      if (id.startsWith('train_')) {
        const type = id.replace(/^train_/, '');
        const level = parseInt(s.level, 10) || 0;
        const qty = parseFloat(s.qty) || 0;
        if (level <= 0 || qty <= 0) continue;
        rows.push({
          id,
          name: `Train ${type}`,
          detail: `T${level} × ${qty}${s.speedup ? ' · +Speedups' : ''}`,
          active: !!s.active,
        });
        continue;
      }

      if (id.startsWith('promo_')) {
        const type = id.replace(/^promo_/, '');
        const from = parseInt(s.from, 10) || 0;
        const to = parseInt(s.to, 10) || 0;
        const qty = parseFloat(s.qty) || 0;
        if (from <= 0 || to <= from || qty <= 0) continue;
        rows.push({
          id,
          name: `Promote ${type}`,
          detail: `T${from} → T${to} × ${qty}${s.speedup ? ' · +Speedups' : ''}`,
          active: !!s.active,
        });
        continue;
      }

      // Legacy shape: from/to only
      if (hasUpgradeRange(s.from, s.to)) {
        rows.push({
          id,
          name: id,
          detail: levelLabel(s.from, s.to),
          active: !!s.active,
        });
      }
    }
    return rows;
  }

  if (key === 'heroes') {
    const flowers = state.heroFlowers || {};
    const heroes = state.heroes || {};
    const names = new Set([...Object.keys(flowers), ...Object.keys(heroes)]);
    for (const name of names) {
      const f = flowers[name] || {};
      const h = heroes[name] || {};
      const cur = Number.isFinite(Number(f.currentMaxIdx)) ? Number(f.currentMaxIdx) : -1;
      const tgt = Number.isFinite(Number(f.targetMaxIdx)) ? Number(f.targetMaxIdx) : -1;
      // Real selection: target petal beyond current (or any non-default pair)
      const hasPetals = tgt > cur && tgt >= 0;
      const hasStars = hasUpgradeRange(h.starFrom, h.starTo);
      if (!hasPetals && !hasStars) continue;
      const parts = [];
      if (hasPetals) parts.push(`Petals ${cur < 0 ? '—' : cur} → ${tgt}`);
      if (hasStars) parts.push(`Stars ${levelLabel(h.starFrom, h.starTo)}`);
      rows.push({
        id: name,
        name,
        detail: parts.join(' · '),
        active: !!h.active,
      });
    }
    return rows;
  }

  if (key === 'heroGear') {
    const hg = state.heroGear || {};
    const items = Array.isArray(hg.items) ? hg.items : [];
    // legacy single card
    if (!items.length && hasUpgradeRange(hg.from, hg.to)) {
      items.push({ id: 'gear_legacy', from: hg.from, to: hg.to, active: hg.active });
    }
    items.forEach((it, i) => {
      if (!it || !hasUpgradeRange(it.from, it.to)) return;
      rows.push({
        id: it.id || `gear_${i}`,
        name: `Hero Gear #${i + 1}`,
        detail: levelLabel(it.from, it.to),
        active: !!it.active,
      });
    });

    const forgeItems = Array.isArray(hg.forgeItems) ? hg.forgeItems : [];
    if (!forgeItems.length && hasUpgradeRange(hg.forgeFrom, hg.forgeTo)) {
      forgeItems.push({
        id: 'forge_legacy',
        from: hg.forgeFrom,
        to: hg.forgeTo,
        active: hg.forgeActive,
      });
    }
    forgeItems.forEach((it, i) => {
      if (!it || !hasUpgradeRange(it.from, it.to)) return;
      rows.push({
        id: it.id || `forge_${i}`,
        name: `Forgehammer #${i + 1}`,
        detail: levelLabel(it.from, it.to),
        active: !!it.active,
      });
    });
    return rows;
  }

  if (key === 'misc') {
    const m = state.misc || {};
    const spins = parseFloat(String(m.roulette || '').replace(/[^0-9.]/g, '')) || 0;
    if (spins > 0) {
      rows.push({
        id: 'roulette',
        name: 'Hero Roulette',
        detail: `${m.roulette} spins`,
        active: !!m.rouletteActive,
      });
    }
    const grip = parseInt(m.bisonGrip || '0', 10) || 0;
    if (grip > 0) {
      rows.push({
        id: 'bison',
        name: 'Bison Grip',
        detail: `${grip}× · ${m.bisonResource || 'bread'} node ${m.bisonNode || '—'}`,
        active: !!m.gatherActive,
      });
    }
    const cards = m.gatheringCards || {};
    Object.entries(cards).forEach(([id, c]) => {
      if (!c || typeof c !== 'object') return;
      if (!c.resource || !c.node) return;
      rows.push({
        id: `march_${id}`,
        name: `Gathering March ${Number(id) + 1}`,
        detail: `${c.resource} · Node ${c.node} · Skill ${c.skill ?? 0}`,
        active: !!m.gatherActive,
      });
    });
    return rows;
  }

  return rows;
}

function ScorePill({ value }) {
  return (
    <span className="profile-score-pill">
      {formatNumber(value || 0)} <small>pts</small>
    </span>
  );
}

export default function ProfilePage() {
  const { user, setAuthOpen, setAuthMode, logout } = useAuth();
  const { state, currentName, globalScore, presetList } = useApp();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, true]))
  );

  const pageScores = state.pageScores || {};

  const sections = useMemo(() => {
    return SECTIONS.map((sec) => {
      const rows = collectRows(sec.key, state);
      const activeCount = rows.filter((r) => r.active).length;
      const plannedCount = rows.filter((r) => !r.active).length;
      return {
        ...sec,
        rows,
        activeCount,
        plannedCount,
        score: Number(pageScores[sec.scoreKey]) || 0,
      };
    });
  }, [state, pageScores]);

  const totals = useMemo(() => {
    let active = 0;
    let planned = 0;
    for (const s of sections) {
      active += s.activeCount;
      planned += s.plannedCount;
    }
    return { active, planned, total: active + planned };
  }, [sections]);

  const toggle = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const filterRows = (rows) => {
    if (filter === 'active') return rows.filter((r) => r.active);
    if (filter === 'planned') return rows.filter((r) => !r.active);
    return rows;
  };

  return (
    <div className="app-container profile-page">
      <div className="item-card profile-account">
        <div className="item-card-header">
          <span>Profile overview</span>
          <ScorePill value={globalScore} />
        </div>
        <div className="item-card-body">
          {user ? (
            <div className="profile-meta">
              <div>
                <span className="profile-meta-label">Username</span>
                <strong>{user.username}</strong>
              </div>
              <div>
                <span className="profile-meta-label">Game ID</span>
                <strong>{user.gameId || '—'}</strong>
              </div>
              <div>
                <span className="profile-meta-label">Email</span>
                <strong>{user.email || '—'}</strong>
              </div>
              <div>
                <span className="profile-meta-label">Preset</span>
                <strong>{currentName}</strong>
              </div>
              <div>
                <span className="profile-meta-label">Presets</span>
                <strong>{(presetList || []).length}</strong>
              </div>
              <button type="button" className="preset-btn btn-delete" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="profile-guest">
              <p className="hint" style={{ margin: 0 }}>
                Guest mode — preview uses the current local preset. Register to save cloud presets.
              </p>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setAuthMode('register');
                  setAuthOpen(true);
                }}
              >
                Register / Login
              </button>
            </div>
          )}

          <div className="profile-summary-bar">
            <div className="profile-stat">
              <span className="profile-stat-num">{totals.total}</span>
              <span className="profile-stat-label">Selections</span>
            </div>
            <div className="profile-stat profile-stat-active">
              <span className="profile-stat-num">{totals.active}</span>
              <span className="profile-stat-label">Active upgrades</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-num">{totals.planned}</span>
              <span className="profile-stat-label">Planned only</span>
            </div>
            <div className="profile-stat profile-stat-score">
              <span className="profile-stat-num">{formatNumber(globalScore || 0)}</span>
              <span className="profile-stat-label">Total points</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-filters">
        {[
          ['all', 'All'],
          ['active', 'Active only'],
          ['planned', 'Planned only'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`preset-btn ${filter === id ? 'active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="preset-btn"
          onClick={() => setOpen(Object.fromEntries(SECTIONS.map((s) => [s.key, true])))}
        >
          Expand all
        </button>
        <button
          type="button"
          className="preset-btn"
          onClick={() => setOpen(Object.fromEntries(SECTIONS.map((s) => [s.key, false])))}
        >
          Collapse all
        </button>
      </div>

      <div className="item-card profile-scoreboard">
        <div className="item-card-header">Points by page</div>
        <div className="item-card-body profile-score-grid">
          {sections.map((s) => (
            <Link key={s.key} to={s.path} className="profile-score-cell">
              <span className="profile-score-name">{s.title}</span>
              <span className="profile-score-val">{formatNumber(s.score)}</span>
              <span className="profile-score-sub">
                {s.activeCount} active · {s.plannedCount} planned
              </span>
            </Link>
          ))}
        </div>
      </div>

      {sections.map((sec) => {
        const rows = filterRows(sec.rows);
        const isOpen = open[sec.key] !== false;
        return (
          <div className="item-card profile-section" key={sec.key}>
            <button
              type="button"
              className="item-card-header profile-section-toggle"
              onClick={() => toggle(sec.key)}
            >
              <span>
                {sec.title}
                <span className="profile-section-badge">
                  {sec.activeCount} active
                  {sec.plannedCount ? ` · ${sec.plannedCount} planned` : ''}
                </span>
              </span>
              <span className="profile-section-right">
                <ScorePill value={sec.score} />
                <span className="toggle-icon">{isOpen ? '▼' : '▶'}</span>
              </span>
            </button>
            {isOpen && (
              <div className="item-card-body">
                {!sec.rows.length ? (
                  <p className="hint" style={{ margin: 0 }}>
                    No levels selected yet. <Link to={sec.path}>Open {sec.title}</Link>
                  </p>
                ) : !rows.length ? (
                  <p className="hint" style={{ margin: 0 }}>
                    Nothing matches this filter.
                  </p>
                ) : (
                  <div className="profile-table-wrap">
                    <table className="profile-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Levels / detail</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className={r.active ? 'is-active' : ''}>
                            <td className="profile-col-name">{r.name}</td>
                            <td>
                              <div>{r.detail}</div>
                            </td>
                            <td>
                              <span
                                className={
                                  r.active ? 'profile-tag active' : 'profile-tag planned'
                                }
                              >
                                {r.active ? 'ACTIVE' : 'Planned'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="profile-section-footer">
                  <Link to={sec.path} className="preset-btn">
                    Edit on {sec.title} →
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
