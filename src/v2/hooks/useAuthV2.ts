/**
 * useAuthV2 — STEP 3: Auth hook completo
 *
 * Login email/password, Google OAuth, profilo, ruoli, whitelist.
 * Nessun throw — tutto Result-based internamente, stato React per UI.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────

export type AppRole = "admin" | "moderator" | "user";

export interface UserProfile {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}

export interface AuthState {
  readonly user: User | null;
  readonly session: Session | null;
  readonly profile: UserProfile | null;
  readonly roles: readonly AppRole[];
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly isAdmin: boolean;
  readonly error: string | null;
}

interface AuthActions {
  readonly signInWithEmail: (email: string, password: string) => Promise<void>;
  readonly signInWithGoogle: () => Promise<void>;
  readonly signUp: (email: string, password: string, displayName: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly resetPassword: (email: string) => Promise<void>;
  readonly updatePassword: (newPassword: string) => Promise<void>;
  readonly clearError: () => void;
}

export type UseAuthV2Return = AuthState & AuthActions;

// ── Helper: load profile ─────────────────────────────────────────────

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    userId,
    email: "",
    displayName: data.display_name,
    avatarUrl: null,
  };
}

// ── Helper: load roles ───────────────────────────────────────────────

async function loadRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (!data || data.length === 0) return ["user"];
  return data.map((row) => row.role as AppRole);
}

// ── Helper: check whitelist ──────────────────────────────────────────

async function isEmailAuthorized(email: string): Promise<boolean> {
  const { data } = await supabase
    .from("authorized_users")
    .select("id")
    .eq("email", email.toLowerCase())
    .eq("is_active", true)
    .maybeSingle();

  return data !== null;
}

// ── Helper: record login ─────────────────────────────────────────────

async function recordLogin(email: string): Promise<void> {
  await supabase
    .from("authorized_users")
    .update({
      last_login_at: new Date().toISOString(),
      login_count: undefined, // will be handled by DB
    })
    .eq("email", email.toLowerCase());
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAuthV2(): UseAuthV2Return {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<readonly AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null && session !== null;
  const isAdmin = roles.includes("admin");

  // ── Load user data after auth ────────────────────────────────────

  const loadUserData = useCallback(async (authUser: User) => {
    const email = authUser.email;
    if (!email) {
      await supabase.auth.signOut();
      setError("Account senza email associata.");
      return;
    }

    const authorized = await isEmailAuthorized(email);
    if (!authorized) {
      await supabase.auth.signOut();
      setError("Email non autorizzata. Contatta l'amministratore.");
      return;
    }

    const [userProfile, userRoles] = await Promise.all([
      loadProfile(authUser.id),
      loadRoles(authUser.id),
    ]);

    setProfile(userProfile);
    setRoles(userRoles);
    await recordLogin(email);
  }, []);

  // ── Session listener ─────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          setTimeout(() => {
            if (mounted) {
              loadUserData(currentSession.user).finally(() => {
                if (mounted) setIsLoading(false);
              });
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        loadUserData(initialSession.user).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Fallback timer (5s max loading)
    const fallbackTimer = setTimeout(() => {
      if (mounted && isLoading) setIsLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [loadUserData]);

  // ── Actions ──────────────────────────────────────────────────────

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/v2` },
    });
    if (authError) setError(authError.message);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    setIsLoading(true);

    const authorized = await isEmailAuthorized(email);
    if (!authorized) {
      setError("Email non autorizzata. Contatta l'amministratore per essere aggiunto alla whitelist.");
      setIsLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/v2/reset-password`,
    });
    if (authError) setError(authError.message);
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) setError(authError.message);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user, session, profile, roles,
    isLoading, isAuthenticated, isAdmin, error,
    signInWithEmail, signInWithGoogle, signUp,
    signOut, resetPassword, updatePassword, clearError,
  };
}
