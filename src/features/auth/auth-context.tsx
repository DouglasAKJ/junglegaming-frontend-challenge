import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserProfile, LoginInput, RegisterInput } from '@/types/contracts';
import { api, getStoredToken, setStoredToken, onSessionExpired } from '@/lib/api';
import { queryKeys, purgePrivateQueries } from '@/lib/query';
import { socketManager } from '@/lib/socket';
import { useToast } from '@/components/ui/toast-provider';

interface AuthModalState {
  isOpen: boolean;
  mode: 'login' | 'register';
  redirectTo?: string | null;
  reason?: string | null;
  onSuccessCallback?: (() => void) | null;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authModal: AuthModalState;
  openAuthModal: (options?: {
    mode?: 'login' | 'register';
    redirectTo?: string | null;
    reason?: string | null;
    onSuccess?: () => void;
  }) => void;
  closeAuthModal: () => void;
  login: (input: LoginInput) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserProfile | null>;
  updateUserInContext: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authModal, setAuthModal] = useState<AuthModalState>({
    isOpen: false,
    mode: 'login',
    redirectTo: null,
    reason: null,
    onSuccessCallback: null,
  });

  const applyAuthenticatedSession = useCallback(
    (token: string, nextUser: UserProfile) => {
      const previousUserId = user?.id || null;
      if (previousUserId && previousUserId !== nextUser.id) {
        purgePrivateQueries(queryClient);
      }
      setStoredToken(token);
      setUser(nextUser);
      socketManager.setUserId(nextUser.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.cart(nextUser.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites(nextUser.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets(nextUser.id) });
    },
    [queryClient, user?.id]
  );

  const clearSessionState = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    socketManager.setUserId(null);
    purgePrivateQueries(queryClient);
  }, [queryClient]);

  const refreshSession = useCallback(async (): Promise<UserProfile | null> => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      setTimeout(() => {
        socketManager.init(queryClient, null);
      }, 120);
      return null;
    }

    try {
      void socketManager.init(queryClient, null);
      const session = await api.auth.getSession();
      setUser(session.user);
      socketManager.setUserId(session.user.id);
      return session.user;
    } catch {
      clearSessionState();
      socketManager.init(queryClient, null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [clearSessionState, queryClient]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    return onSessionExpired(() => {
      clearSessionState();
      addToast({
        title: 'Sessão expirada',
        description: 'Sua sessão expirou. Entre novamente para retomar de onde parou.',
        variant: 'warning',
      });
      setAuthModal((prev) => ({
        ...prev,
        isOpen: true,
        mode: 'login',
        reason: 'Sua sessão expirou. Autentique-se para continuar sem perder seu progresso.',
      }));
    });
  }, [addToast, clearSessionState]);

  const openAuthModal = useCallback(
    (options?: {
      mode?: 'login' | 'register';
      redirectTo?: string | null;
      reason?: string | null;
      onSuccess?: () => void;
    }) => {
      setAuthModal({
        isOpen: true,
        mode: options?.mode || 'login',
        redirectTo: options?.redirectTo ?? null,
        reason: options?.reason ?? null,
        onSuccessCallback: options?.onSuccess ?? null,
      });
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModal((prev) => ({
      ...prev,
      isOpen: false,
      reason: null,
      onSuccessCallback: null,
    }));
  }, []);

  const login = useCallback(
    async (input: LoginInput): Promise<UserProfile> => {
      const session = await api.auth.login(input);
      applyAuthenticatedSession(session.token, session.user);
      addToast({
        title: `Bem-vindo de volta, ${session.user.displayName}!`,
        description: 'Sessão iniciada e carrinho sincronizado.',
        variant: 'success',
      });
      return session.user;
    },
    [addToast, applyAuthenticatedSession]
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<UserProfile> => {
      const session = await api.auth.register(input);
      applyAuthenticatedSession(session.token, session.user);
      addToast({
        title: 'Conta criada com sucesso!',
        description: `Bem-vindo à Kurio, ${session.user.displayName}.`,
        variant: 'success',
      });
      return session.user;
    },
    [addToast, applyAuthenticatedSession]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network error on logout
    }
    clearSessionState();
    addToast({
      title: 'Sessão encerrada',
      description: 'Você saiu da sua conta com segurança.',
      variant: 'info',
    });
  }, [addToast, clearSessionState]);

  const updateUserInContext = useCallback((updated: UserProfile) => {
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        authModal,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        refreshSession,
        updateUserInContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
