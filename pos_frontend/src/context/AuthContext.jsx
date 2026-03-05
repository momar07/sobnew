import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE_URL = 'http://localhost:8000/api';

// NOTE:
// - We store ONLY tokens in localStorage (access_token, refresh_token)
// - We DO NOT cache user/permissions/ui in localStorage
// - On app start (and on window focus), we fetch a fresh /auth/me/
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ui, setUi] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const isRefreshingRef = useRef(false);

  const applyMe = useCallback((data) => {
    const apiGroups = data?.groups || data?.user?.groups || [];
    const mergedUser = { ...(data?.user || null), groups: apiGroups };
    setUser(mergedUser);
    setGroups(apiGroups);
    setUi(data?.ui || null);
    setPermissions(data?.permissions || []);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setGroups([]);
    setUi(null);
    setPermissions([]);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return null;

    // Prevent parallel refresh storms
    if (isRefreshingRef.current) return null;
    isRefreshingRef.current = true;

    try {
      const resp = await api.post('/auth/refresh/', { refresh });
      const access = resp.data?.access;
      if (access) {
        localStorage.setItem('access_token', access);
        return access;
      }
      return null;
    } catch (e) {
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const fetchMe = useCallback(async (token) => {
    // Cache-buster query param to avoid any intermediate caching
    const resp = await api.get(`/auth/me/`, {
      params: { _: Date.now() },
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.data;
  }, []);

  const ensureMe = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return false;

    try {
      const data = await fetchMe(token);
      applyMe(data);
      return true;
    } catch (error) {
      // If token expired, try refresh once then retry /me
      if (error?.response?.status === 401) {
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          try {
            const data = await fetchMe(newAccess);
            applyMe(data);
            return true;
          } catch (e2) {
            clearAuth();
            return false;
          }
        }
      }
      clearAuth();
      return false;
    }
  }, [applyMe, clearAuth, fetchMe, refreshAccessToken]);

  const checkAuth = useCallback(async () => {
    try {
      await ensureMe();
    } finally {
      setLoading(false);
    }
  }, [ensureMe]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Refresh /me on window focus (so any admin/group/UI builder changes reflect quickly)
  useEffect(() => {
    let lastRun = 0;

    const onFocus = async () => {
      const now = Date.now();
      // basic throttle (avoid refetch loops)
      if (now - lastRun < 1500) return;
      lastRun = now;

      const hasToken = !!localStorage.getItem('access_token');
      if (hasToken) {
        await ensureMe();
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [ensureMe]);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login/', { username, password });
      const { access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Always fetch a fresh /me after login (no cached user/UI)
      const data = await fetchMe(access);
      applyMe(data);

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'فشل تسجيل الدخول',
      };
    }
  };

  const logout = () => {
    clearAuth();
  };

  const isAdmin = () => groups.includes('Admins') || user?.is_superuser || user?.is_staff;
  const isManager = () => groups.includes('Managers');
  const isCashier = () => groups.includes('Cashiers') || groups.includes('Cashier Plus');

  const hasPermission = (perm) => {
    if (!perm) return true;
    return permissions.includes(perm);
  };

  const hasAnyPermission = (perms = []) => {
    if (!perms?.length) return true;
    return perms.some((p) => permissions.includes(p));
  };

  const getActions = (pageKey) => {
    return ui?.actions?.[pageKey] || [];
  };

  const hasAction = (pageKey, actionKey) => {
    return getActions(pageKey).some((a) => a.action_key === actionKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        ui,
        permissions,
        groups,
        login,
        logout,
        loading,
        hasPermission,
        hasAnyPermission,
        getActions,
        hasAction,
        isAdmin,
        isManager,
        isCashier,
        refreshMe: ensureMe,
        clearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
