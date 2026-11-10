import { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api/index';

const AuthContext = createContext(null);

/**
 * AuthProvider — manages JWT token and user state.
 *
 * Token is persisted to localStorage so the session survives a page reload.
 * On mount, if a token exists, the /auth/me endpoint is called to restore
 * the user object. If the token is invalid or expired, the session is cleared.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUser(null);
      setSessionError('');
      setLoading(false);
      return;
    }

    async function restoreSession() {
      try {
        const data = await authApi.me(token);
        if (cancelled) return;
        setUser(data.user);
        setSessionError('');
      } catch (error) {
        if (cancelled) return;
        if (error.status === 401) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        } else {
          setSessionError('Unable to verify your session. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    restoreSession();
    window.addEventListener('focus', restoreSession);
    window.addEventListener('auth:refresh', restoreSession);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', restoreSession);
      window.removeEventListener('auth:refresh', restoreSession);
    };
  }, [token, restoreAttempt]);

  function login(newToken, userData) {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSessionError('');
  }

  function updateUser(userData) {
    setUser(userData);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, sessionError, retrySession: () => setRestoreAttempt((n) => n + 1), login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — consume the AuthContext.
 *
 * Throws if used outside of AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
