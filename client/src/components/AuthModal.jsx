import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function AuthModal() {
  const { authOpen, setAuthOpen, authMode, setAuthMode, authMessage, login, register } = useAuth();
  const { createPrimaryForNewUser } = useApp();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        const data = await register(username, email, password, gameId.trim());
        if (data?.user && createPrimaryForNewUser) {
          await createPrimaryForNewUser(data.user);
        }
      } else {
        await login(email, password);
      }
      setUsername('');
      setEmail('');
      setPassword('');
      setGameId('');
      setShowPassword(false);
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      data-auth-modal
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={() => setAuthOpen(false)}
    >
      <div
        className="item-card"
        data-auth-modal
        style={{ width: '100%', maxWidth: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="item-card-header">
          <span>{authMode === 'register' ? 'Register' : 'Login'}</span>
        </div>
        <div className="item-card-body">
          {authMessage && <p className="hint">{authMessage}</p>}
          <form onSubmit={submit} data-auth-modal>
            {authMode === 'register' && (
              <>
                <div className="buff-field" style={{ marginBottom: 10 }}>
                  <label>Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    autoComplete="username"
                  />
                </div>
                <div className="buff-field" style={{ marginBottom: 10 }}>
                  <label>Game ID</label>
                  <input
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    required
                    placeholder="Your in-game ID"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            <div className="buff-field" style={{ marginBottom: 10 }}>
              <label>Email {authMode === 'login' && '(or username)'}</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={authMode === 'login' ? 'username' : 'email'}
              />
            </div>
            <div className="buff-field" style={{ marginBottom: 10 }}>
              <label>Password</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="text-deficit" style={{ marginBottom: 8 }}>
                {error}
              </div>
            )}
            <button type="submit" className="preset-btn" disabled={busy} style={{ width: '100%' }}>
              {busy ? '…' : authMode === 'register' ? 'Create account' : 'Login'}
            </button>
          </form>
          <p style={{ marginTop: 12, fontSize: '0.85rem', textAlign: 'center' }}>
            {authMode === 'register' ? (
              <>
                Already have an account?{' '}
                <button type="button" className="preset-btn" onClick={() => setAuthMode('login')}>
                  Login
                </button>
              </>
            ) : (
              <>
                New here?{' '}
                <button type="button" className="preset-btn" onClick={() => setAuthMode('register')}>
                  Register
                </button>
              </>
            )}
          </p>
          <p className="hint" style={{ marginTop: 8 }}>
            Login is required to use the calculator and save presets. You stay logged in until you
            click Logout.
          </p>
        </div>
      </div>
    </div>
  );
}
