'use client';

import type { LoginRequest, LoginResponse, RegisterRequest, User, UserSession } from '@orbitchat/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { login as apiLogin, logout as apiLogout, refresh, register as apiRegister } from '@/lib/api/auth';
import { clearAccessToken, getAccessToken } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { getUser } from '@/lib/api/users';

interface AuthContextValue {
  user: User | null;
  session: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAuthFromLogin: (data: LoginResponse) => void;
  setSessionState: (next: UserSession) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAuthFromLogin = useCallback((data: LoginResponse) => {
    setUser(data.user);
    setSession(data.session);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const data = await refresh();
      setSession(data.session);
      const currentUser = await getUser(data.session.userId);
      setUser(currentUser);
    } catch {
      clearAccessToken();
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (input: LoginRequest) => {
      const data = await apiLogin(input);
      setAuthFromLogin(data);
    },
    [setAuthFromLogin]
  );

  const register = useCallback(async (input: RegisterRequest) => {
    await apiRegister(input);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) {
      return;
    }

    const currentUser = await getUser(user.id);
    setUser(currentUser);
  }, [user]);

  const setSessionState = useCallback((next: UserSession) => {
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    if (getAccessToken()) {
      try {
        await apiLogout();
      } catch {
        clearAccessToken();
      }
    } else {
      clearAccessToken();
    }
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: user !== null && getAccessToken() !== null,
      login,
      register,
      logout,
      refreshUser,
      setAuthFromLogin,
      setSessionState,
    }),
    [user, session, isLoading, login, register, logout, refreshUser, setAuthFromLogin, setSessionState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function getAuthErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
