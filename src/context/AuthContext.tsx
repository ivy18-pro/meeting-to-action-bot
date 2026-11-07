import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, tokenStorage, setOnUnauthorized } from '../services/api.js';
import type { User } from '../types.js';
import { useToast } from './ToastContext.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const refreshUser = useCallback(async () => {
    const storedToken = tokenStorage.get();
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.auth.me();
      setUser(res.user);
      setToken(storedToken);
    } catch {
      tokenStorage.remove();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setToken(null);
      showToast('Your session has expired or is invalid. Please log in again.', 'error');
    });

    refreshUser();
  }, [refreshUser, showToast]);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    tokenStorage.set(res.token);
    setToken(res.token);
    setUser(res.user);
    showToast('Successfully logged in!', 'success');
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.auth.register(name, email, password);
    tokenStorage.set(res.token);
    setToken(res.token);
    setUser(res.user);
    showToast('Account created successfully!', 'success');
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStorage.remove();
      setUser(null);
      setToken(null);
      showToast('Logged out successfully.', 'info');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
