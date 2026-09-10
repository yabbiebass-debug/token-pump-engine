import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login as apiLogin, logout as apiLogout, me, refreshSession, tokens } from '@/lib/api';

const AuthContext = createContext({ user: null, login: async () => {}, logout: async () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      if (!tokens.get() && !tokens.getRefresh()) return setUser(false);
      try {
        const u = await me();
        if (alive) setUser(u);
      } catch (_) {
        const rt = tokens.getRefresh();
        if (rt) {
          try {
            const d = await refreshSession(rt);
            tokens.set(d.access_token);
            if (alive) setUser(d.user);
            return;
          } catch (__) { /* expired */ }
        }
        tokens.clear();
        if (alive) setUser(false);
      }
    };
    boot();
    const onLogout = () => setUser(false);
    window.addEventListener('yabbai:logout', onLogout);
    return () => { alive = false; window.removeEventListener('yabbai:logout', onLogout); };
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await apiLogin(email, password);
    tokens.set(d.access_token, d.refresh_token);
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch (_) { /* ignore */ }
    tokens.clear();
    setUser(false);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const useDirectorGuard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const guard = (fn) => (...args) => {
    if (!user) {
      toast.error('Director login required');
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return undefined;
    }
    return fn(...args);
  };
  return { guard, isDirector: !!user, checking: user === null };
};
