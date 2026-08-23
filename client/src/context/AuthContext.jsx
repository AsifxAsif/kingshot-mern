import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { clearGameDataCache } from '../hooks/useGameData';

const AuthContext = createContext(null);

/** Persist across browser restarts until explicit logout */
const TOKEN_KEY = 'kingshot_token';

function readStoredToken() {
  try {
    // Prefer localStorage (stay logged in). Migrate legacy sessionStorage once.
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => readStoredToken());
  const [authReady, setAuthReady] = useState(() => !readStoredToken()); // no token → ready as guest
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      writeStoredToken('');
      setAuthReady(true);
      return;
    }
    writeStoredToken(token);
    let cancelled = false;
    api
      .get('/auth/me', token)
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
        } else {
          setToken('');
          writeStoredToken('');
          setUser(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Invalid / expired token → clear so user can log in again
        setToken('');
        writeStoredToken('');
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (email, password) => {
    clearGameDataCache();
    const data = await api.post('/auth/login', { email, password });
    writeStoredToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setAuthOpen(false);
    setAuthMessage('');
    return data;
  };

  const register = async (username, email, password, gameId) => {
    clearGameDataCache();
    const data = await api.post('/auth/register', { username, email, password, gameId });
    writeStoredToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setAuthOpen(false);
    setAuthMessage('');
    return data;
  };

  const logout = () => {
    clearGameDataCache();
    setToken('');
    setUser(null);
    writeStoredToken('');
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
