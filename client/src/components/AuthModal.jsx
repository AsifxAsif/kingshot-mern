import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import {
  validateUsername,
  validateEmail,
  validatePassword,
  validateGameId,
  sanitizeFieldInput,
  hasDangerousInput,
} from '../utils/authValidation';
import { api } from '../services/api';

export default function AuthModal() {
  const { authOpen, setAuthOpen, authMode, setAuthMode, authMessage, login, register } =
    useAuth();
  const { createPrimaryForNewUser } = useApp();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uidStatus, setUidStatus] = useState({
    state: 'idle',
    message: '',
    player: null,
  });
  const uidCheckTimer = useRef(null);

  useEffect(() => {
    if (!authOpen) return;
    setError('');
    setFieldErrors({});
    setUidStatus({ state: 'idle', message: '', player: null });
  }, [authMode, authOpen]);

  useEffect(() => {
    if (!authOpen || authMode !== 'register') return;
    if (uidCheckTimer.current) clearTimeout(uidCheckTimer.current);

    const local = validateGameId(gameId);
    if (!gameId) {
      setUidStatus({ state: 'idle', message: '', player: null });
      return;
    }
    if (!local.ok) {
      setUidStatus({ state: 'invalid', message: local.error, player: null });
      return;
    }

    setUidStatus({ state: 'checking', message: 'Checking UID…', player: null });
    uidCheckTimer.current = setTimeout(async () => {
      try {
        const data = await api.get(
          `/auth/validate-game-id?q=${encodeURIComponent(local.value)}`
        );
        if (data?.valid) {
          setUidStatus({
            state: 'valid',
            message: data.player?.nick
              ? `✓ Found: ${data.player.nick}`
              : '✓ Valid player UID',
            player: data.player || null,
          });
        } else {
          setUidStatus({
            state: 'invalid',
            message: data?.error || 'UID not found',
            player: null,
          });
        }
      } catch (err) {
        setUidStatus({
          state: 'invalid',
          message: err.message || 'Could not verify UID',
          player: null,
        });
      }
    }, 450);

    return () => {
      if (uidCheckTimer.current) clearTimeout(uidCheckTimer.current);
    };
  }, [gameId, authOpen, authMode]);

  if (!authOpen) return null;

  const onSafeChange = (setter, { digitsOnly = false, maxLen = 128 } = {}) => (e) => {
    const next = sanitizeFieldInput(e.target.value, { digitsOnly, maxLen });
    if (!digitsOnly && hasDangerousInput(e.target.value)) {
      setFieldErrors((fe) => ({
        ...fe,
        general: 'Invalid characters are not allowed',
      }));
    }
    setter(next);
  };

  const validateAll = () => {
    const errs = {};
    if (authMode === 'register') {
      const u = validateUsername(username);
      if (!u.ok) errs.username = u.error;
      const g = validateGameId(gameId);
      if (!g.ok) errs.gameId = g.error;
      else if (uidStatus.state !== 'valid') {
        errs.gameId =
          uidStatus.state === 'checking'
            ? 'Please wait — verifying UID…'
            : uidStatus.message || 'Enter a valid player UID';
      }
      const em = validateEmail(email, { loginMode: false });
      if (!em.ok) errs.email = em.error;
      const pw = validatePassword(password);
      if (!pw.ok) errs.password = pw.error;
    } else {
      const em = validateEmail(email, { loginMode: true });
      if (!em.ok) errs.email = em.error;
      if (hasDangerousInput(password)) {
        errs.password = 'Password contains invalid characters';
      } else if (!password) {
        errs.password = 'Password is required';
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateAll()) return;
    setBusy(true);
    try {
      if (authMode === 'register') {
        const gid = validateGameId(gameId).value;
        const data = await register(
          validateUsername(username).value,
          validateEmail(email).value,
          validatePassword(password).value,
          gid
        );
        if (data?.user && createPrimaryForNewUser) {
          await createPrimaryForNewUser(data.user);
        }
      } else {
        await login(email.trim(), password);
      }
      setUsername('');
      setEmail('');
      setPassword('');
      setGameId('');
      setShowPassword(false);
      setFieldErrors({});
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    setError('');
    setFieldErrors({});
  };

  const eyeOpen = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  const eyeOff = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  return (
    <div className="auth-overlay" data-auth-modal onClick={() => setAuthOpen(false)}>
      <div className="auth-modal" data-auth-modal onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`auth-modal-tab${authMode === 'login' ? ' is-active' : ''}`}
            aria-selected={authMode === 'login'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              switchMode('login');
            }}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            className={`auth-modal-tab${authMode === 'register' ? ' is-active' : ''}`}
            aria-selected={authMode === 'register'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              switchMode('register');
            }}
          >
            Register
          </button>
        </div>

        <div className="auth-modal-body">
          {authMessage ? <p className="auth-modal-banner">{authMessage}</p> : null}

          <form className="auth-modal-form" onSubmit={submit} data-auth-modal noValidate>
            {authMode === 'register' && (
              <>
                <div className="auth-modal-field">
                  <label htmlFor="auth-username">Username</label>
                  <input
                    id="auth-username"
                    value={username}
                    onChange={onSafeChange(setUsername, { maxLen: 32 })}
                    required
                    minLength={3}
                    maxLength={32}
                    autoComplete="username"
                    placeholder="Your username"
                  />
                  {fieldErrors.username ? (
                    <span className="auth-modal-error">{fieldErrors.username}</span>
                  ) : null}
                </div>

                <div className="auth-modal-field">
                  <label htmlFor="auth-gameid">Player UID (Governor ID)</label>
                  <input
                    id="auth-gameid"
                    value={gameId}
                    onChange={onSafeChange(setGameId, { digitsOnly: true, maxLen: 20 })}
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={20}
                    placeholder="Min. 7 digits"
                    autoComplete="off"
                  />
                  {uidStatus.state === 'checking' ? (
                    <span className="auth-modal-status is-checking">{uidStatus.message}</span>
                  ) : null}
                  {uidStatus.state === 'valid' ? (
                    <span className="auth-modal-status is-valid">{uidStatus.message}</span>
                  ) : null}
                  {uidStatus.state === 'invalid' ? (
                    <span className="auth-modal-status is-invalid">{uidStatus.message}</span>
                  ) : null}
                  {fieldErrors.gameId && uidStatus.state !== 'invalid' ? (
                    <span className="auth-modal-error">{fieldErrors.gameId}</span>
                  ) : null}
                </div>
              </>
            )}

            <div className="auth-modal-field">
              <label htmlFor="auth-email">
                {authMode === 'login' ? 'Email or username' : 'Email'}
              </label>
              <input
                id="auth-email"
                value={email}
                onChange={onSafeChange(setEmail, { maxLen: 254 })}
                required
                autoComplete={authMode === 'login' ? 'username' : 'email'}
                placeholder={
                  authMode === 'login' ? 'you@gmail.com or username' : 'you@gmail.com'
                }
              />
              {fieldErrors.email ? (
                <span className="auth-modal-error">{fieldErrors.email}</span>
              ) : null}
            </div>

            <div className="auth-modal-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-modal-password">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    const next = sanitizeFieldInput(e.target.value, { maxLen: 128 });
                    setPassword(next);
                    if (authMode === 'register') {
                      if (!next) {
                        setFieldErrors((fe) => ({ ...fe, password: undefined }));
                      } else {
                        const v = validatePassword(next);
                        setFieldErrors((fe) => ({
                          ...fe,
                          password: v.ok ? undefined : v.error,
                        }));
                      }
                    } else {
                      setFieldErrors((fe) => ({ ...fe, password: undefined }));
                    }
                  }}
                  onBlur={() => {
                    if (authMode !== 'register' || !password) return;
                    const v = validatePassword(password);
                    if (!v.ok) {
                      setFieldErrors((fe) => ({ ...fe, password: v.error }));
                    }
                  }}
                  required
                  minLength={authMode === 'register' ? 8 : 1}
                  autoComplete={
                    authMode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder={
                    authMode === 'register' ? '8+ chars, letters + numbers' : '••••••••'
                  }
                />
                <button
                  type="button"
                  className="auth-modal-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? eyeOff : eyeOpen}
                </button>
              </div>
              {fieldErrors.password ? (
                <span className="auth-modal-error">{fieldErrors.password}</span>
              ) : null}
            </div>

            {(error || fieldErrors.general) ? (
              <p className="auth-modal-error auth-modal-form-error" role="alert">
                {error || fieldErrors.general}
              </p>
            ) : null}

            <div className="auth-modal-actions">
              <button
                type="submit"
                className="auth-modal-submit"
                disabled={
                  busy ||
                  (authMode === 'register' &&
                    (uidStatus.state === 'checking' || uidStatus.state === 'invalid'))
                }
              >
                {busy
                  ? 'Please wait…'
                  : authMode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
