import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { formatNumber } from '../utils/calc';
import AssetImg from '../components/AssetImg';
import {
  asset,
  buildingImg,
  heroImg,
  heroWidgetImg,
  heroWidgetFallbacks,
  troopImg,
  petImg,
  warAcademyImg,
  resourceImg,
  govGearImg,
  govCharmImg,
} from '../utils/images';

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

const VALID_GOV_GEAR = ['Helmet', 'Watch', 'Armor', 'Pant', 'Belt', 'Weapon'];
const VALID_GOV_CHARMS = [
  'Helmet Charm #1', 'Helmet Charm #2', 'Helmet Charm #3',
  'Watch Charm #1', 'Watch Charm #2', 'Watch Charm #3',
  'Armor Charm #1', 'Armor Charm #2', 'Armor Charm #3',
  'Pant Charm #1', 'Pant Charm #2', 'Pant Charm #3',
  'Belt Charm #1', 'Belt Charm #2', 'Belt Charm #3',
  'Weapon Charm #1', 'Weapon Charm #2', 'Weapon Charm #3',
];

function str(v) {
  if (v == null || v === '') return null;
  return String(v);
}

function hasUpgradeRange(from, to) {
  const a = str(from);
  const b = str(to);
  if (a == null || b == null) return false;
  if (a === b) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return nb > na;
  return true;
}

function levelLabel(from, to) {
  return `${str(from) ?? '—'} → ${str(to) ?? '—'}`;
}

function resolveImage(sectionKey, row) {
  const name = row.name || '';
  const id = row.id || '';
  const levelForImg = row.to || row.from || null;
  try {
    switch (sectionKey) {
      case 'buildings':
        return { src: buildingImg(name), fallbacks: [] };
      case 'troops': {
        const type = id.replace(/^(train_|promo_)/, '') || name;
        return { src: troopImg(type), fallbacks: [] };
      }
      case 'warAcademy':
        return { src: warAcademyImg(name), fallbacks: [asset('war_academy.webp')] };
      case 'heroes':
        return { src: heroImg(name), fallbacks: [] };
      case 'widgets':
        return {
          src: heroWidgetImg(name),
          fallbacks: heroWidgetFallbacks(name),
        };
      case 'pets':
        return { src: petImg(name), fallbacks: [] };
      case 'heroGear':
        if (String(id).includes('forge') || /forge/i.test(name)) {
          return { src: asset('forge_hammer.webp'), fallbacks: [] };
        }
        return {
          src: asset('hero-gear-mythic.webp'),
          fallbacks: [asset('hero-gear-red.webp'), asset('mythic-gear.webp')],
        };
      case 'govGear': {
        // Target level image (falls back to current)
        const src = govGearImg(name, levelForImg);
        const cur = row.from ? govGearImg(name, row.from) : null;
        return {
          src,
          fallbacks: [cur, asset('mythic-gear.webp')].filter(Boolean),
        };
      }
      case 'govCharm': {
        const src = govCharmImg(name, levelForImg);
        const cur = row.from ? govCharmImg(name, row.from) : null;
        return {
          src,
          fallbacks: [cur, asset('charm_design.webp'), asset('charm_guide.webp')].filter(Boolean),
        };
      }
      case 'misc':
        if (id === 'roulette') return { src: asset('hero_roulette.webp'), fallbacks: [] };
        if (id === 'bison') return { src: asset('grip_of_the_titan.webp'), fallbacks: [] };
        if (String(id).startsWith('march_')) {
          const res = (row.detail || '').split('·')[0]?.trim()?.toLowerCase() || 'bread';
          return { src: resourceImg(res), fallbacks: [asset('gathering_speed.webp')] };
        }
        return { src: asset('gathering_speed.webp'), fallbacks: [] };
      default:
        return { src: asset('vault_icon.webp'), fallbacks: [] };
    }
  } catch {
    return { src: asset('vault_icon.webp'), fallbacks: [] };
  }
}

function collectRows(key, state) {
  const rows = [];

  if (key === 'govGear') {
    const section = state.govGear || {};
    for (const name of VALID_GOV_GEAR) {
      const s = section[name];
      if (!s || typeof s !== 'object') continue;
      if (!hasUpgradeRange(s.from, s.to)) continue;
      rows.push({
        id: name,
        name,
        from: s.from,
        to: s.to,
        detail: levelLabel(s.from, s.to),
        active: !!s.active,
      });
    }
    return rows;
  }

  if (key === 'govCharm') {
    const section = state.govCharm || {};
    for (const name of VALID_GOV_CHARMS) {
      const s = section[name];
      if (!s || typeof s !== 'object') continue;
      if (!hasUpgradeRange(s.from, s.to)) continue;
      rows.push({
        id: name,
        name,
        from: s.from,
        to: s.to,
        detail: levelLabel(s.from, s.to),
        active: !!s.active,
      });
    }
    return rows;
  }

  if (key === 'buildings' || key === 'warAcademy' || key === 'pets' || key === 'widgets') {
    const section = state[key] || {};
    for (const [name, s] of Object.entries(section)) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
      if (!name || name === 'undefined') continue;
      if (!hasUpgradeRange(s.from, s.to)) continue;
      const parts = [levelLabel(s.from, s.to)];
      if (s.speedup) parts.push('+Spd');
      rows.push({
        id: name,
        name,
        from: s.from,
        to: s.to,
        detail: parts.join(' · '),
        active: !!s.active,
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
          detail: `T${level} ×${qty}`,
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
          detail: `T${from}→${to} ×${qty}`,
          active: !!s.active,
        });
        continue;
      }
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
      const hasPetals = tgt > cur && tgt >= 0;
      if (!hasPetals && !hasUpgradeRange(h.starFrom, h.starTo)) continue;
      const parts = [];
      if (hasPetals) parts.push(`${cur < 0 ? '—' : cur}→${tgt}`);
      if (hasUpgradeRange(h.starFrom, h.starTo)) parts.push(`★ ${levelLabel(h.starFrom, h.starTo)}`);
      rows.push({ id: name, name, detail: parts.join(' · '), active: !!h.active });
    }
    return rows;
  }

  if (key === 'heroGear') {
    const hg = state.heroGear || {};
    const items = Array.isArray(hg.items) ? [...hg.items] : [];
    if (!items.length && hasUpgradeRange(hg.from, hg.to)) {
      items.push({ id: 'gear_legacy', from: hg.from, to: hg.to, active: hg.active });
    }
    items.forEach((it, i) => {
      if (!it || !hasUpgradeRange(it.from, it.to)) return;
      rows.push({
        id: it.id || `gear_${i}`,
        name: `Gear #${i + 1}`,
        detail: levelLabel(it.from, it.to),
        active: !!it.active,
      });
    });
    const forgeItems = Array.isArray(hg.forgeItems) ? [...hg.forgeItems] : [];
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
        name: `Forge #${i + 1}`,
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
        name: 'Roulette',
        detail: `${m.roulette} spins`,
        active: !!m.rouletteActive,
      });
    }
    const grip = parseInt(m.bisonGrip || '0', 10) || 0;
    if (grip > 0) {
      rows.push({
        id: 'bison',
        name: 'Bison Grip',
        detail: `${grip}× ${m.bisonResource || ''}`,
        active: !!m.gatherActive,
      });
    }
    Object.entries(m.gatheringCards || {}).forEach(([id, c]) => {
      if (!c?.resource || !c?.node) return;
      rows.push({
        id: `march_${id}`,
        name: `March ${Number(id) + 1}`,
        detail: `${c.resource} · N${c.node}`,
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

function ItemTile({ sectionKey, row }) {
  const img = resolveImage(sectionKey, row);
  const showPair = sectionKey === 'govGear' || sectionKey === 'govCharm';
  return (
    <div className={`profile-item-tile ${row.active ? 'is-active' : ''}`}>
      <span className={`tile-badge ${row.active ? 'active' : 'planned'}`}>
        {row.active ? 'Active' : 'Plan'}
      </span>
      {showPair && row.from && row.to ? (
        <div className="tile-img-pair">
          <AssetImg
            src={
              sectionKey === 'govGear'
                ? govGearImg(row.name, row.from)
                : govCharmImg(row.name, row.from)
            }
            size={40}
            alt={`${row.name} current`}
            className="tile-img"
          />
          <span className="tile-arrow">→</span>
          <AssetImg
            src={img.src}
            fallbacks={img.fallbacks}
            size={40}
            alt={`${row.name} target`}
            className="tile-img"
          />
        </div>
      ) : (
        <AssetImg
          src={img.src}
          fallbacks={img.fallbacks}
          size={56}
          alt={row.name}
          className="tile-img"
        />
      )}
      <span className="tile-name" title={row.name}>
        {row.name}
      </span>
      <span className="tile-levels">{row.detail}</span>
    </div>
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
      return {
        ...sec,
        rows,
        activeCount: rows.filter((r) => r.active).length,
        plannedCount: rows.filter((r) => !r.active).length,
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

  const filterRows = (rows) => {
    if (filter === 'active') return rows.filter((r) => r.active);
    if (filter === 'planned') return rows.filter((r) => !r.active);
    return rows;
  };

  return (
    <div className="app-container profile-page">
      <div className="item-card profile-account">
        <div className="item-card-header" style={{ justifyContent: 'space-between' }}>
          <span>Profile overview</span>
          <ScorePill value={globalScore} />
        </div>
        <div className="item-card-body">
          {user ? (
            <div
              className="profile-meta"
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-evenly',
                flexWrap: 'wrap',
              }}
            >
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
                Guest mode — overview uses your local preset. Register to sync cloud presets.
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
              <span className="profile-stat-label">Active</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-num">{totals.planned}</span>
              <span className="profile-stat-label">Planned</span>
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
          ['active', 'Active'],
          ['planned', 'Planned'],
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

      <div className="item-card">
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
          <div className="item-card profile-section" key={sec.key} style={{ marginTop: 12 }}>
            <button
              type="button"
              className="item-card-header profile-section-toggle"
              onClick={() => setOpen((p) => ({ ...p, [sec.key]: !isOpen }))}
            >
              <span>
                {sec.title}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                  }}
                >
                  {sec.activeCount} active
                  {sec.plannedCount ? ` · ${sec.plannedCount} planned` : ''}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ScorePill value={sec.score} />
                <span>{isOpen ? '▼' : '▶'}</span>
              </span>
            </button>
            {isOpen && (
              <div className="item-card-body">
                {!sec.rows.length ? (
                  <p className="hint" style={{ margin: 0 }}>
                    No selections yet. <Link to={sec.path}>Open {sec.title}</Link>
                  </p>
                ) : !rows.length ? (
                  <p className="hint" style={{ margin: 0 }}>
                    Nothing matches this filter.
                  </p>
                ) : (
                  <div className="profile-item-grid">
                    {rows.map((r) => (
                      <ItemTile key={r.id} sectionKey={sec.key} row={r} />
                    ))}
                  </div>
                )}
                <div className="profile-section-footer">
                  <Link to={sec.path} className="preset-btn">
                    Edit {sec.title} →
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
