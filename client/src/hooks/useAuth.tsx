import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { User } from "@/types";
import { authApi } from "@/services/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      setUser(res.data.data);
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    const { user: u, accessToken, refreshToken } = res.data.data;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(u);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch { /* ok */ }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    // Hard navigation instead of a router push: clearing the user and moving
    // routes happen in separate render passes, which lets the login guard and
    // the root signup fallback fight over the final URL (landing on /signup).
    window.location.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
