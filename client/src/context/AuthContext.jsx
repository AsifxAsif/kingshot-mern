import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { clearGameDataCache, prefetchGameData } from '../hooks/useGameData';
import { clearPlayerCache, prefetchPlayer } from '../services/playerCache';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

/** Persist across browser restarts until explicit logout */
const TOKEN_KEY = 'kingshot_token';
const USER_KEY = 'kingshot_user_v1';

function readStoredToken() {
  try {
    const local = localStorage.getItem(TOKEN_KEY);
    if (local) return local;
    const session = sessionStorage.getItem(TOKEN_KEY);
    if (session) {
      localStorage.setItem(TOKEN_KEY, session);
      sessionStorage.removeItem(TOKEN_KEY);
      return session;
    }
  } catch {
    /* private mode */
  }
  return '';
}

function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* */
  }
}

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || typeof u !== 'object') return null;
    return u;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* quota / private */
  }
}

function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return true;
  // fetch failed (offline / DNS) — no HTTP status
  if (err.status == null && err.name === 'TypeError') return true;
  if (err.message && /failed to fetch|networkerror|load failed|offline/i.test(err.message)) {
    return true;
  }
  return false;
}

function isAuthRejected(err) {
  const s = err?.status;
  return s === 401 || s === 403;
}

export function AuthProvider({ children }) {
  const toast = useToast();
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(() => {
    // Instant restore so offline reload keeps the session visible
    const t = readStoredToken();
    if (!t) return null;
    return readCachedUser();
  });
  const [authReady, setAuthReady] = useState(() => {
    // Guest with no token is ready immediately; token holders wait for me/cache path
    const t = readStoredToken();
    if (!t) return true;
    // If we already have a cached user, treat as ready (offline-safe) while revalidate runs
    return !!readCachedUser();
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      writeStoredToken('');
      writeCachedUser(null);
      setAuthReady(true);
      return;
    }
    writeStoredToken(token);

    // Offline + cached user → stay signed in, skip network
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
        setAuthReady(true);
        return;
      }
      // Token but no cached user offline — cannot verify; keep token, mark ready as guest-like
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    api
      .get('/auth/me', token)
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
          writeCachedUser(data.user);
          prefetchGameData();
          if (data.user.gameId) {
            prefetchPlayer().catch(() => {});
          }
        } else {
          // Empty response while online → clear
          setToken('');
          writeStoredToken('');
          writeCachedUser(null);
          setUser(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (isAuthRejected(err)) {
          // Real invalid/expired token
          setToken('');
          writeStoredToken('');
          writeCachedUser(null);
          setUser(null);
          return;
        }
        // Network / offline / server down — keep session from cache
        const cached = readCachedUser();
        if (cached) {
          setUser(cached);
        }
        // Keep token either way so reconnect can revalidate
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // When coming back online, revalidate session quietly
  useEffect(() => {
    const onOnline = () => {
      const t = readStoredToken();
      if (!t) return;
      api
        .get('/auth/me', t)
        .then((data) => {
          if (data?.user) {
            setUser(data.user);
            writeCachedUser(data.user);
          }
        })
        .catch((err) => {
          if (isAuthRejected(err)) {
            setToken('');
            writeStoredToken('');
            writeCachedUser(null);
            setUser(null);
          }
        });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const login = async (email, password) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const err = new Error('You are offline. Connect to the internet to sign in.');
      err.code = 'OFFLINE';
      throw err;
    }
    clearGameDataCache();
    clearPlayerCache();
    const data = await api.post('/auth/login', { email, password });
    writeStoredToken(data.token);
    writeCachedUser(data.user);
    setToken(data.token);
    toast.success('Signed in');
    setUser(data.user);
    setAuthOpen(false);
    setAuthMessage('');
    prefetchGameData();
    if (data.user?.gameId) prefetchPlayer().catch(() => {});
    return data;
  };

  const register = async (username, email, password, gameId) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const err = new Error('You are offline. Connect to the internet to register.');
      err.code = 'OFFLINE';
      throw err;
    }
    clearGameDataCache();
    clearPlayerCache();
    const data = await api.post('/auth/register', { username, email, password, gameId });
    writeStoredToken(data.token);
    writeCachedUser(data.user);
    setToken(data.token);
    toast.success('Account created');
    setUser(data.user);
    setAuthOpen(false);
    setAuthMessage('');
    prefetchGameData();
    if (data.user?.gameId) prefetchPlayer().catch(() => {});
    return data;
  };

  const logout = () => {
    clearGameDataCache();
    clearPlayerCache();
    toast.info('Signed out');
    setToken('');
    setUser(null);
    writeStoredToken('');
    writeCachedUser(null);
  };

  const requireAuth = useCallback((message = 'Please login or register to use the calculator') => {
    setAuthMessage(message);
    setAuthMode('login');
    setAuthOpen(true);
  }, []);

  const isAuthenticated = !!(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authReady,
        isAuthenticated,
        login,
        register,
        logout,
        authOpen,
        setAuthOpen,
        authMode,
        setAuthMode,
        authMessage,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
