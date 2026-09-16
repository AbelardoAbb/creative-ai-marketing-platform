/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  UserIdentity,
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  hasRolePermission,
  canUserApproveContent,
  SupabaseConfigStatus,
} from '../types/auth';

export type AuthStateStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'blocked' | 'error';

export interface AuthContextValue {
  authStatus: AuthStateStatus;
  user: UserIdentity | null;
  session: Session | null;
  error: string | null;
  isBlocked: boolean;
  blockedDetails: SupabaseConfigStatus | null;
  // DEV/TEST ONLY visual role override
  devVisualRole: UserRole | null;
  setDevVisualRole: (role: UserRole | null) => void;
  // Auth actions
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  canApprove: (contentCreatorId: string) => { allowed: boolean; reason?: string };
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStateStatus>('loading');
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedDetails, setBlockedDetails] = useState<SupabaseConfigStatus | null>(null);
  const [devVisualRole, setDevVisualRole] = useState<UserRole | null>(null);

  // Fetch real identity and authorized role from the backend
  const fetchServerIdentity = useCallback(async (token: string): Promise<UserIdentity | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[Auth] Backend rejected token — session expired or invalid');
        }
        return null;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[Auth] Server returned non-JSON response for identity resolution');
        return null;
      }

      const data = await res.json();
      return data.user as UserIdentity;
    } catch (err) {
      console.warn('[Auth] Could not resolve server identity, using session credentials:', err);
      return null;
    }
  }, []);

  // Check Supabase availability & restore session
  const initializeAuth = useCallback(async () => {
    setAuthStatus('loading');
    setError(null);

    // 1. Query server for Supabase status
    try {
      const statusRes = await fetch('/api/auth/status');
      if (statusRes.ok) {
        const contentType = statusRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const configStatus: SupabaseConfigStatus = await statusRes.json();
          if (configStatus.status === 'BLOCKED' || !configStatus.configured) {
            setIsBlocked(true);
            setBlockedDetails(configStatus);
            setAuthStatus('blocked');
            return;
          }
        }
      }
    } catch (statusErr) {
      console.warn('[Auth] Unable to reach /api/auth/status:', statusErr);
    }

    // 2. Check client-side configuration
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      setIsBlocked(true);
      setBlockedDetails({
        status: 'BLOCKED',
        configured: false,
        supabaseUrl: null,
        missingEnvVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
        reason: 'Cliente Supabase no configurado en el frontend.',
      });
      setAuthStatus('blocked');
      return;
    }

    setIsBlocked(false);

    // 3. Detect existing Supabase Auth session
    try {
      const {
        data: { session: initialSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[Auth] Session detection error:', sessionError);
        setError(sessionError.message);
        setAuthStatus('unauthenticated');
        return;
      }

      if (initialSession) {
        setSession(initialSession);
        const identity = await fetchServerIdentity(initialSession.access_token);
        if (identity) {
          setUser(identity);
          setAuthStatus('authenticated');
        } else {
          // If server rejects token or table isn't reachable, keep fallback info from token
          const tokenUser = initialSession.user;
          const fallbackIdentity: UserIdentity = {
            id: tokenUser.id,
            email: tokenUser.email || '',
            displayName:
              tokenUser.user_metadata?.full_name ||
              tokenUser.user_metadata?.name ||
              tokenUser.email?.split('@')[0] ||
              'Usuario',
            role: (tokenUser.user_metadata?.role as UserRole) || 'Designer',
            accountStatus: 'active',
          };
          setUser(fallbackIdentity);
          setAuthStatus('authenticated');
        }
      } else {
        setSession(null);
        setUser(null);
        setAuthStatus('unauthenticated');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fallo al inicializar autenticación.';
      console.error('[Auth] Initialization error:', err);
      setError(message);
      setAuthStatus('unauthenticated');
    }
  }, [fetchServerIdentity]);

  useEffect(() => {
    initializeAuth();

    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Supabase native auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession) {
          setSession(currentSession);
          const identity = await fetchServerIdentity(currentSession.access_token);
          if (identity) {
            setUser(identity);
          }
          setAuthStatus('authenticated');
          setError(null);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setAuthStatus('unauthenticated');
      } else if (event === 'USER_UPDATED') {
        if (currentSession) {
          const identity = await fetchServerIdentity(currentSession.access_token);
          if (identity) setUser(identity);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, fetchServerIdentity]);

  // Sign In using real Supabase Auth
  const signInWithPassword = async (email: string, password: string) => {
    setError(null);
    const supabase = getSupabaseClient();

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase no está configurado. El servicio está en estado BLOCKED.',
      };
    }

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        const errorMsg =
          signInErr.message === 'Invalid login credentials'
            ? 'Credenciales inválidas. Verifique su correo electrónico y contraseña.'
            : signInErr.message;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (data.session) {
        setSession(data.session);
        const identity = await fetchServerIdentity(data.session.access_token);
        if (identity) {
          setUser(identity);
        }
        setAuthStatus('authenticated');
        return { success: true };
      }

      return { success: false, error: 'Sesión no devuelta por Supabase.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar inicio de sesión.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign Up using real Supabase Auth
  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    setError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase no está configurado.' };
    }

    // Minimum RBAC Correction: Force unprivileged roles for newly registered users.
    // Administrator and Approver cannot be self-assigned through client metadata.
    const safeRole: UserRole = (role === 'Copywriter') ? 'Copywriter' : 'Designer';

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: safeRole,
          },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        return { success: false, error: signUpErr.message };
      }

      if (data.session) {
        setSession(data.session);
        const identity = await fetchServerIdentity(data.session.access_token);
        if (identity) setUser(identity);
        setAuthStatus('authenticated');
        return { success: true };
      } else if (data.user) {
        return {
          success: true,
          message: '¡Registro realizado! Si la confirmación por correo electrónico está activa en su Supabase, revise su bandeja de entrada.',
        };
      }

      return { success: false, error: 'No fue posible completar el registro.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar usuario.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign Out using real Supabase Auth
  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('[Auth] Sign out error:', err);
      }
    }
    setSession(null);
    setUser(null);
    setDevVisualRole(null);
    setAuthStatus('unauthenticated');
  };

  // Permission verification using real user role
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      // NOTE: Uses the real user role, NEVER client-modified spoofing!
      const effectiveRole = user?.role;
      if (!effectiveRole) return false;
      return hasRolePermission(effectiveRole, permission);
    },
    [user]
  );

  // Anti-Self-Approval enforcement check
  const canApprove = useCallback(
    (contentCreatorId: string) => {
      if (!user) return { allowed: false, reason: 'Usuario no autenticado.' };
      return canUserApproveContent(user.id, user.role, contentCreatorId);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        authStatus,
        user,
        session,
        error,
        isBlocked,
        blockedDetails,
        devVisualRole,
        setDevVisualRole,
        signInWithPassword,
        signUp,
        signOut,
        hasPermission,
        canApprove,
        refreshSession: initializeAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
