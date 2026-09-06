import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Role } from "../lib/core";
import * as api from "../lib/api";
import type { SafeUser } from "../lib/api";

interface AuthState {
  user: SafeUser | null;
  token: string | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<SafeUser>;
  register: (name: string, email: string, password: string, role: Role, orcid: string, scopusId: string) => Promise<SafeUser>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setTok] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = api.getToken();
    if (!t) { setBooting(false); return; }
    api.me(t)
      .then((u) => { setUser(u); setTok(t); })
      .catch(() => api.setToken(null))
      .finally(() => setBooting(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    api.setToken(res.token);
    setTok(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: Role, orcid: string, scopusId: string) => {
    const res = await api.register(name, email, password, role, orcid, scopusId);
    api.setToken(res.token);
    setTok(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setTok(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, token, booting, login, register, logout }), [user, token, booting, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

export function homeFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "FACULTY" ? "/faculty" : "/student";
}
