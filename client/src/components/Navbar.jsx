import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  '/buildings': 'buildings',
  '/war-academy': 'warAcademy',
  '/widgets': 'widgets',
  '/heroes': 'heroes',
  '/hero-gear': 'heroGear',
  '/gov-gear': 'govGear',
  '/gov-charm': 'govCharm',
  '/pets': 'pets',
  '/troops': 'troops',
  '/misc': 'misc',
};

export default function Navbar() {
  const { user, logout, requireAuth, setAuthOpen, setAuthMode } = useAuth();
  const {
    presetList,
    currentName,
    globalScore,
    state,
    saving,
    switchPreset,
    createPreset,
    deletePreset,
    resetCurrentPage,
    resetPresetFull,
  } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setPresetOpen(false);
  }, [location.pathname]);

  const pageLabel = PAGE_LABELS[location.pathname] ?? null;
  const pageScoreKey = PATH_TO_SCORE_KEY[location.pathname];
  const pageScore = pageScoreKey
    ? parseInt(state.pageScores?.[pageScoreKey] || 0, 10) || 0
    : null;

  const handleNew = async () => {
    if (!user) {
      requireAuth('Register or login to create a new preset.');
      return;
    }
    const name = prompt('New preset name:');
    if (name?.trim()) {
      try {
        await createPreset(name.trim());
        setPresetOpen(false);
      } catch (err) {
        if (err.code === 'AUTH_REQUIRED') requireAuth(err.message);
        else alert(err.message);
      }
    }
  };

  const handleDelete = async () => {
    if (!user) {
      requireAuth('Login required to manage presets.');
      return;
    }
    if (!currentName) return;
    if (!confirm(`Delete preset "${currentName}" from database?`)) return;
    try {
      await deletePreset(currentName);
      setPresetOpen(false);
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  const handleResetFull = async () => {
    if (!confirm(`Reset ALL data on preset "${currentName}"?`)) return;
    try {
      if (resetPresetFull) await resetPresetFull();
      else resetCurrentPage(location.pathname);
      setPresetOpen(false);
    } catch (e) {
      alert(e.message || 'Reset failed');
    }
  };

  return (
    <div className="navbar">
      <div className="navbar-row-1">
        <label className="hamburger" id="hamburgerIcon">
          <input
            type="checkbox"
            id="hamburgerCheckbox"
            checked={menuOpen}
            onChange={() => {
              setMenuOpen((v) => !v);
              setPresetOpen(false);
            }}
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
              onClick={(e) => {
                setMenuOpen(false);
                if (location.pathname !== l.to) {
                  e.preventDefault();
                  navigate(l.to);
                }
              }}
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Mobile preset menu toggle */}
        <button
          type="button"
          className={`preset-hamburger${presetOpen ? ' active' : ''}`}
          aria-label="Preset menu"
          title="Presets"
          onClick={() => {
            setPresetOpen((v) => !v);
            setMenuOpen(false);
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.2 7.2 0 00-1.62-.94l-.36-2.54A.48.48 0 0014 2h-4a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.65 8.87a.49.49 0 00.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.77 14.5a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.3.59.22l2.39-.96c.5.39 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h4c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/>
          </svg>
        </button>
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
            <div className="lcd-label">Strongest Governor{saving ? '…' : ''}</div>
            <div className="lcd-value">{globalScore.toLocaleString()}</div>
          </div>
        </div>

        <div className="preset-controls">
          <div className={`preset-dropdown${presetOpen ? ' show' : ''}`} id="presetDropdown">
            <select
              id="presetSelect"
              className="preset-select"
              value={currentName}
              onChange={(e) => switchPreset(e.target.value)}
            >
              {presetList.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="preset-btn" onClick={handleNew} title="Create New Preset">
              New
            </button>
            <button type="button" className="preset-btn btn-delete" onClick={handleDelete} title="Delete Preset">
              Delete
            </button>
            <button
              type="button"
              className="btn-reset"
              onClick={() => resetCurrentPage(location.pathname)}
              title="Reset this page only"
            >
              Reset page
            </button>
            <button type="button" className="btn-reset" onClick={handleResetFull} title="Reset entire preset">
              Reset all
            </button>
            {user ? (
              <button type="button" className="preset-btn" onClick={logout} title={user.email}>
                {user.username} · Logout
              </button>
            ) : (
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setAuthMode('login');
                  setAuthOpen(true);
                }}
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
