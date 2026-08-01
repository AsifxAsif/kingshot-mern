import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { authOpen, setAuthOpen, authMode, setAuthMode, authMessage, login, register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!authOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (authMode === 'register') {
        if (!gameId.trim()) {
          setError('Game ID is required');
          setBusy(false);
          return;
        }
        await register(username, email, password, gameId.trim());
      } else {
        await login(email, password);
      }
      setUsername('');
      setEmail('');
      setPassword('');
      setGameId('');
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: 16,
      }}
      onClick={() => setAuthOpen(false)}
    >
      <div className="item-card" style={{ width: 'min(400px, 100%)', margin: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="item-card-header">
          <span>{authMode === 'register' ? 'Register' : 'Login'}</span>
        </div>
        <div className="item-card-body">
          {authMessage && <p className="hint">{authMessage}</p>}
          <form onSubmit={submit}>
            {authMode === 'register' && (
              <>
                <div className="buff-field" style={{ marginBottom: 10 }}>
                  <label>Username</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
                </div>
                <div className="buff-field" style={{ marginBottom: 10 }}>
                  <label>Game ID</label>
                  <input
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    required
                    placeholder="Your in-game ID"
                  />
                </div>
              </>
            )}
            <div className="buff-field" style={{ marginBottom: 10 }}>
              <label>Email {authMode === 'login' && '(or username)'}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="buff-field" style={{ marginBottom: 10 }}>
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <div className="text-deficit" style={{ marginBottom: 8 }}>{error}</div>}
            <button type="submit" className="preset-btn" disabled={busy} style={{ width: '100%' }}>
              {busy ? '…' : authMode === 'register' ? 'Create account' : 'Login'}
            </button>
          </form>
          <p style={{ marginTop: 12, fontSize: '0.85rem', textAlign: 'center' }}>
            {authMode === 'register' ? (
              <>Already have an account?{' '}
                <button type="button" className="preset-btn" onClick={() => setAuthMode('login')}>Login</button>
              </>
            ) : (
              <>New here?{' '}
                <button type="button" className="preset-btn" onClick={() => setAuthMode('register')}>Register</button>
              </>
            )}
          </p>
          <p className="hint" style={{ marginTop: 8 }}>
            Guests use the <strong>default</strong> preset only. Register to save extra presets + Game ID.
          </p>
        </div>
      </div>
    </div>
  );
}
