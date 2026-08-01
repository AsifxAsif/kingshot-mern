import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/', label: 'VAULT' },
  { to: '/buildings', label: 'BUILDINGS' },
  { to: '/war-academy', label: 'WAR ACADEMY' },
  { to: '/widgets', label: 'WIDGETS' },
  { to: '/heroes', label: 'HEROES' },
  { to: '/hero-gear', label: 'HERO GEAR' },
  { to: '/gov-gear', label: 'GOV GEAR' },
  { to: '/gov-charm', label: 'GOV CHARM' },
  { to: '/pets', label: 'PETS' },
  { to: '/troops', label: 'TROOPS' },
  { to: '/misc', label: 'MISC' },
  { to: '/profile', label: 'PROFILE' },
];

const PAGE_LABELS = {
  '/': null,
  '/buildings': 'BUILDING SCORE',
  '/war-academy': 'ACADEMY SCORE',
  '/widgets': 'WIDGETS SCORE',
  '/heroes': 'HEROES SCORE',
  '/hero-gear': 'HERO GEAR SCORE',
  '/gov-gear': 'GOV GEAR SCORE',
  '/gov-charm': 'GOV CHARM SCORE',
  '/pets': 'PETS SCORE',
  '/troops': 'TROOPS SCORE',
  '/misc': 'MISC SCORE',
};

const PATH_TO_SCORE_KEY = {
  '/buildings': 'score_buildings',
  '/war-academy': 'score_academy',
  '/widgets': 'score_widgets',
  '/heroes': 'score_heroes',
  '/hero-gear': 'score_herogear',
  '/gov-gear': 'score_govgear',
  '/gov-charm': 'score_govcharm',
  '/pets': 'score_pets',
  '/troops': 'score_troops',
  '/misc': 'score_misc',
};

export default function Navbar() {
  const { user, logout, requireAuth, setAuthOpen, setAuthMode } = useAuth();
  const {
    presetList, currentName, globalScore, state, saving,
    switchPreset, createPreset, deletePreset, resetCurrentPage,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const pageLabel = PAGE_LABELS[location.pathname];
  const pageScoreKey = PATH_TO_SCORE_KEY[location.pathname];
  const pageScore = pageScoreKey
    ? parseInt(state.pageScores?.[pageScoreKey] || 0, 10) || 0
    : null;

  const handleNew = async () => {
    if (!user) {
      requireAuth('Register or login to create a new preset. Guests can only use the default preset.');
      return;
    }
    const name = prompt('New preset name:');
    if (name?.trim()) {
      try {
        await createPreset(name.trim());
      } catch (err) {
        if (err.code === 'AUTH_REQUIRED') requireAuth(err.message);
        else alert(err.message);
      }
    }
  };
  const handleDelete = () => {
    if (currentName === 'default') return alert('Cannot delete default');
    if (confirm(`Delete preset "${currentName}" from database?`)) deletePreset(currentName);
  };

  return (
    <div className="navbar">
      <div className="navbar-row-1">
        <label className="hamburger" id="hamburgerIcon">
          <input
            type="checkbox"
            id="hamburgerCheckbox"
            checked={menuOpen}
            onChange={() => setMenuOpen((v) => !v)}
          />
          <svg viewBox="0 0 32 32">
            <path
              className="line line-top-bottom"
              d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
            />
            <path className="line" d="M7 16 27 16" />
          </svg>
        </label>
        <div className={`nav-links${menuOpen ? ' show' : ''}`} id="navLinks">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="navbar-row-2">
        <div className="scoreboard-total">
          {pageLabel != null && (
            <div className="scoreboard">
              <div className="lcd-label">{pageLabel}</div>
              <div className="lcd-value">{(pageScore || 0).toLocaleString()}</div>
            </div>
          )}
          <div className="scoreboard">
            <div className="lcd-label">
              Strongest Governor
            </div>
            <div className="lcd-value">{globalScore.toLocaleString()}</div>
          </div>
        </div>
        <div className="preset-controls">
          <div className="preset-dropdown" id="presetDropdown">
            <select
              id="presetSelect"
              className="preset-select"
              value={currentName}
              onChange={(e) => switchPreset(e.target.value)}
            >
              {presetList.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <button type="button" className="preset-btn" onClick={handleNew} title="Create New Preset">
              <i className="fas fa-plus" /> New
            </button>
            <button type="button" className="preset-btn btn-delete" onClick={handleDelete} title="Delete Preset">
              <i className="fa-regular fa-trash-can" /> Delete
            </button>
            <button type="button" className="btn-reset" onClick={() => resetCurrentPage(location.pathname)}>
              <i className="fa-solid fa-rotate-left" /> Reset
            </button>
            {user ? (
              <button type="button" className="preset-btn" onClick={logout} title={user.email}>
                {user.username} · Logout
              </button>
            ) : (
              <button
                type="button"
                className="preset-btn"
                onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
