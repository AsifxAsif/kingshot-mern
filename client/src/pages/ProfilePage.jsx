import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { formatNumber } from '../utils/calc';

function levelProgress(from, to, maxHint) {
  const a = from != null && from !== '' ? String(from) : '—';
  const b = to != null && to !== '' ? String(to) : '—';
  return { current: a, target: b, max: maxHint || '—' };
}

export default function ProfilePage() {
  const { user, setAuthOpen, setAuthMode, logout } = useAuth();
  const { state, currentName, globalScore, presetList } = useApp();

  const buildings = useMemo(() => {
    const b = state.buildings || {};
    return Object.entries(b).map(([name, s]) => ({
      name,
      ...levelProgress(s?.from, s?.to),
      active: !!s?.active,
    }));
  }, [state.buildings]);

  const troops = useMemo(() => {
    const t = state.troops || {};
    return Object.entries(t).map(([name, s]) => ({
      name,
      ...levelProgress(s?.from, s?.to),
      active: !!s?.active,
    }));
  }, [state.troops]);

  const heroes = useMemo(() => {
    const flowers = state.heroFlowers || {};
    return Object.entries(flowers).map(([name, s]) => ({
      name,
      current: s?.currentMaxIdx ?? -1,
      target: s?.targetMaxIdx ?? -1,
      active: !!(state.heroes?.[name]?.active),
    }));
  }, [state.heroFlowers, state.heroes]);

  const pageScores = state.pageScores || {};

  if (!user) {
    return (
      <div className="app-container">
        <div className="item-card">
          <div className="item-card-header">Profile</div>
          <div className="item-card-body">
            <p className="hint">You are using the guest default preset. Register to save your Game ID and extra presets.</p>
            <button
              type="button"
              className="preset-btn"
              onClick={() => { setAuthMode('register'); setAuthOpen(true); }}
            >
              Register / Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="item-card" style={{ marginBottom: 16 }}>
        <div className="item-card-header">Account</div>
        <div className="item-card-body">
          <div><strong>Username:</strong> {user.username}</div>
          <div><strong>Email:</strong> {user.email}</div>
          <div><strong>Game ID:</strong> {user.gameId || '—'}</div>
          <div><strong>Current preset:</strong> {currentName}</div>
          <div><strong>Strongest Governor:</strong> {formatNumber(globalScore)}</div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="preset-btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="item-card" style={{ marginBottom: 16 }}>
        <div className="item-card-header">Presets</div>
        <div className="item-card-body">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(presetList || []).map((p) => (
              <li key={p.name}>{p.name}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="item-card" style={{ marginBottom: 16 }}>
        <div className="item-card-header">Page scores</div>
        <div className="item-card-body">
          {Object.keys(pageScores).length === 0 ? (
            <p className="hint">No active scores yet</p>
          ) : (
            Object.entries(pageScores).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{k.replace('score_', '')}</span>
                <strong>{formatNumber(v)}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section-title">Buildings (current → target)</div>
      <div className="items-grid cards-grid">
        {buildings.length === 0 ? (
          <p className="hint">No building levels selected</p>
        ) : (
          buildings.map((b) => (
            <div className="item-card" key={b.name}>
              <div className="item-card-header">{b.name}</div>
              <div className="item-card-body">
                <div>Current: <strong>{b.current}</strong></div>
                <div>Target: <strong>{b.target}</strong></div>
                <div>{b.active ? '✓ Active upgrade' : 'Not active'}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="section-title">Troops</div>
      <div className="items-grid cards-grid">
        {troops.length === 0 ? (
          <p className="hint">No troop selections</p>
        ) : (
          troops.map((b) => (
            <div className="item-card" key={b.name}>
              <div className="item-card-header">{b.name}</div>
              <div className="item-card-body">
                <div>Current: <strong>{b.current}</strong></div>
                <div>Target: <strong>{b.target}</strong></div>
                <div>{b.active ? '✓ Active' : 'Not active'}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="section-title">Hero flowers (petal index)</div>
      <div className="items-grid cards-grid">
        {heroes.length === 0 ? (
          <p className="hint">No hero petal selections</p>
        ) : (
          heroes.map((h) => (
            <div className="item-card" key={h.name}>
              <div className="item-card-header">{h.name}</div>
              <div className="item-card-body">
                <div>Current idx: <strong>{h.current}</strong></div>
                <div>Target idx: <strong>{h.target}</strong></div>
                <div>{h.active ? '✓ Active' : 'Not active'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
