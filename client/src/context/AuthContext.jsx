import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'kingshot_token'; // only auth token in sessionStorage (not game data)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    api.get('/auth/me', token).then((data) => {
      if (data?.user) setUser(data.user);
      else {
        setToken('');
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }).catch(() => {
      setToken('');
      sessionStorage.removeItem(TOKEN_KEY);
    });
  }, [token]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    setAuthOpen(false);
    return data;
  };

  const register = async (username, email, password, gameId) => {
    const data = await api.post('/auth/register', { username, email, password, gameId });
    setToken(data.token);
    setUser(data.user);
    setAuthOpen(false);
    return data;
  };

  const logout = () => {
    setToken('');
    setUser(null);
    sessionStorage.removeItem(TOKEN_KEY);
  };

  const requireAuth = useCallback((message = 'Register or login to create presets') => {
    setAuthMessage(message);
    setAuthMode('register');
    setAuthOpen(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
