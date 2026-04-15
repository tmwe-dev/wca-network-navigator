/**
 * useAuthV2 — Auth hook completo
 *
 * Login email/password, profilo, ruoli, whitelist.
 * Session state sourced from centralized AuthProvider.
 * Google OAuth RIMOSSO — solo email+password+whitelist.
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

// ── Helper: check whitelist (throws on network error) ────────────────

async function isEmailAuthorized(email: string): Promise<boolean> {
  return rpcIsEmailAuthorized(normalizeEmail(email));
}

// ── Helper: record login ─────────────────────────────────────────────

async function recordLogin(email: string): Promise<void> {
  try {
    await rpcRecordUserLogin(normalizeEmail(email));
  } catch {
    // non-critical
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAuthV2(): UseAuthV2Return {
  const { session, user, status } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<readonly AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null && session !== null;
  const isAdmin = roles.includes("admin");

  // ── Load user data after auth ────────────────────────────────────

  const loadUserData = useCallback(async (authUser: User) => {
    try {
      const email = authUser.email;
      if (!email) {
        setError("Account senza email associata.");
        return;
      }

      // Do NOT re-check whitelist on session restore — user already passed it at login.
      // Whitelist is only checked in signInWithEmail() and signUp().
      // This prevents sign-outs when the DB returns 503.

      const [userProfile, userRoles] = await Promise.allSettled([
        loadProfile(authUser.id),
        loadRoles(authUser.id),
      ]);

      setProfile(userProfile.status === "fulfilled" ? userProfile.value : null);
      setRoles(userRoles.status === "fulfilled" ? (userRoles.value ?? ["user"]) : ["user"]);

      // Fire-and-forget login record
      recordLogin(email);
    } catch (err) {
      // Network errors should NOT block the session
      console.warn("[useAuthV2] loadUserData non-critical error:", err);
      // Still let user in — profile/roles will be defaults
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
      setError("Errore di connessione al server. Riprova tra qualche istante.");
      setIsLoading(false);
      return;
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

    try {
      const authorized = await isEmailAuthorized(normalizedEmail);
      if (!authorized) {
        setError("Email non autorizzata. Contatta l'amministratore per essere aggiunto alla whitelist.");
        setIsLoading(false);
        return;
      }
    } catch (err) {
      setError("Errore di connessione al server. Riprova tra qualche istante.");
      setIsLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
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
      redirectTo: `${window.location.origin}/reset-password`,
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
