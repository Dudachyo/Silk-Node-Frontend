import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { setActiveAccount } from "../api/session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();
  const generation = useRef(0);
  const authBusy = useRef(false);

  const clearData = useCallback(() => {
    queryClient.cancelQueries();
    queryClient.removeQueries();
  }, [queryClient]);

  const checkSession = useCallback(async ({ showLoading = true } = {}) => {
    const current = ++generation.current;
    if (showLoading) setIsLoading(true);
    setSessionError(null);
    try {
      const data = await api.me();
      if (current === generation.current) {
        setActiveAccount(data.id);
        setUser(data);
      }
      return data;
    } catch (error) {
      if (current === generation.current) {
        setUser(null);
        setActiveAccount(null);
        clearData();
        if (error.status !== 401) setSessionError(error);
      }
      throw error;
    } finally {
      if (current === generation.current) setIsLoading(false);
    }
  }, [clearData]);

  useEffect(() => {
    checkSession().catch(() => {});
    return () => { generation.current++; };
  }, [checkSession]);

  const authenticate = useCallback(async (action, email, password) => {
    if (authBusy.current) return;
    authBusy.current = true;
    try {
      await action(email, password);
      setActiveAccount(null);
      clearData();
      await checkSession({ showLoading: false });
    } finally {
      authBusy.current = false;
    }
  }, [checkSession, clearData]);

  const login = useCallback((email, password) => authenticate(api.login, email, password), [authenticate]);
  const register = useCallback((email, password) => authenticate(api.register, email, password), [authenticate]);

  const logout = useCallback(async () => {
    if (authBusy.current) return;
    authBusy.current = true;
    setIsLoggingOut(true);
    try {
      // On failure keep the session visible so logout can be retried.
      await api.logout();
      generation.current++;
      setActiveAccount(null);
      setUser(null);
      setSessionError(null);
      setIsLoading(false);
      clearData();
    } finally {
      authBusy.current = false;
      setIsLoggingOut(false);
    }
  }, [clearData]);

  return (
    <AuthContext.Provider value={{ user, isLoading, sessionError, isLoggingOut, isAuthenticated: !!user, login, register, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
