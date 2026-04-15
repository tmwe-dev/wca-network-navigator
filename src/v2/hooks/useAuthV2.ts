/**
 * useAuthV2 — STEP 3: Auth hook completo
 *
 * Login email/password, Google OAuth, profilo, ruoli, whitelist.
 * Session state sourced from centralized AuthProvider.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

import { rpcIsEmailAuthorized, rpcRecordUserLogin } from "@/data/rpc";
import type { User, Session } from "@supabase/supabase-js";
import { useAuth } from "@/providers/AuthProvider";

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
  
  readonly signUp: (email: string, password: string, displayName: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly resetPassword: (email: string) => Promise<void>;
  readonly updatePassword: (newPassword: string) => Promise<void>;
  readonly clearError: () => void;
}

export type UseAuthV2Return = AuthState & AuthActions;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getDisplayName(authUser: User): string | null {
  return authUser.user_metadata?.full_name
    ?? authUser.user_metadata?.display_name
    ?? authUser.user_metadata?.name
    ?? authUser.email
    ?? null;
}

function buildFallbackProfile(authUser: User): UserProfile {
  return {
    userId: authUser.id,
    email: authUser.email ?? "",
    displayName: getDisplayName(authUser),
    avatarUrl: null,
  };
}

function isTransientBootstrapError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /abort|lock broken|timeout|timed out|network|fetch|context deadline|retryable/i.test(message);
}

// ── Helper: load profile ─────────────────────────────────────────────

async function loadProfile(authUser: User): Promise<UserProfile | null> {
  const userId = authUser.id;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    return {
      userId,
      email: authUser.email ?? "",
      displayName: data.display_name,
      avatarUrl: null,
    };
  }

  // Auto-creazione profilo se mancante (utenti pre-trigger)
  const displayName = getDisplayName(authUser);

  const { error: insertErr } = await supabase
    .from("profiles")
    .insert({ user_id: userId, display_name: displayName });

  if (insertErr) {
    console.warn("[useAuthV2] Auto-create profilo fallito:", insertErr.message);
    return null;
  }

  return {
    userId,
    email: authUser.email ?? "",
    displayName,
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
  return rpcIsEmailAuthorized(normalizeEmail(email));
}

// ── Helper: record login ─────────────────────────────────────────────

async function recordLogin(email: string): Promise<void> {
  await rpcRecordUserLogin(normalizeEmail(email));
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAuthV2(): UseAuthV2Return {
  // Source session/user from centralized AuthProvider
  const { session, user, status } = useAuth();

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

    try {
      const authorized = await isEmailAuthorized(email);
      if (!authorized) {
        await supabase.auth.signOut();
        setError("Email non autorizzata. Contatta l'amministratore.");
        return;
      }
    } catch (err) {
      if (!isTransientBootstrapError(err)) {
        await supabase.auth.signOut();
        setError(err instanceof Error ? err.message : "Errore durante la verifica accesso.");
        return;
      }
    }

    const fallbackProfile = buildFallbackProfile(authUser);
    const [userProfileResult, userRolesResult] = await Promise.allSettled([
      loadProfile(authUser),
      loadRoles(authUser.id),
    ]);

    setProfile(
      userProfileResult.status === "fulfilled"
        ? userProfileResult.value ?? fallbackProfile
        : fallbackProfile,
    );
    setRoles(
      userRolesResult.status === "fulfilled" && userRolesResult.value.length > 0
        ? userRolesResult.value
        : ["user"],
    );

    try {
      await recordLogin(email);
    } catch (err) {
      if (!isTransientBootstrapError(err)) {
        setError(err instanceof Error ? err.message : "Errore durante la registrazione del login.");
      }
    }
  }, []);

  // ── React to session changes from AuthProvider ───────────────────

  useEffect(() => {
    if (status === "loading") return;

    if (user) {
      setIsLoading(true);
      loadUserData(user).finally(() => setIsLoading(false));
    } else {
      setProfile(null);
      setRoles([]);
      setIsLoading(false);
    }
  }, [user, status, loadUserData]);

  // Fallback timer (5s max loading)
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (isLoading) setIsLoading(false);
    }, 5000);
    return () => clearTimeout(fallbackTimer);
  }, [isLoading]);

  // ── Actions ──────────────────────────────────────────────────────

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    const normalizedEmail = normalizeEmail(email);
    try {
      const authorized = await isEmailAuthorized(normalizedEmail);
      if (!authorized) {
        setError("Email non autorizzata. Contatta l'amministratore.");
        setIsLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifica accesso non disponibile.");
      setIsLoading(false);
      return;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore stale local-session cleanup failures before a fresh login attempt
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    }
  }, []);


  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    setIsLoading(true);

    const normalizedEmail = normalizeEmail(email);

    const authorized = await isEmailAuthorized(normalizedEmail);
    if (!authorized) {
      setError("Email non autorizzata. Contatta l'amministratore per essere aggiunto alla whitelist.");
      setIsLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/v2/login`,
        data: { display_name: displayName },
      },
    });

    if (authError) {
      setError(authError.message);
    }

    setIsLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
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
    signInWithEmail, signUp,
    signOut, resetPassword, updatePassword, clearError,
  };
}
