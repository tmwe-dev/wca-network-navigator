/**
 * useAuthV2 — Auth hook completo
 *
 * Profilo, ruoli, signOut. Session state sourced from centralized AuthProvider.
 * Auth passa esclusivamente da TMWE OAuth + whitelist.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rpcRecordUserLogin } from "@/data/rpc";
import type { User, Session } from "@supabase/supabase-js";
import { useAuth } from "@/providers/AuthProvider";


import { createLogger } from "@/lib/log";
const log = createLogger("useAuthV2");
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
}

interface AuthActions {
  readonly signOut: () => Promise<void>;
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

// ── Helper: record login ─────────────────────────────────────────────

async function recordLogin(email: string): Promise<void> {
  try {
    await rpcRecordUserLogin(email.trim().toLowerCase());
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

  const isAuthenticated = user !== null && session !== null;
  const isAdmin = roles.includes("admin");

  // ── Load user data after auth ────────────────────────────────────

  const loadUserData = useCallback(async (authUser: User) => {
    try {
      const email = authUser.email;
      if (!email) {
        log.warn("[useAuthV2] user without email", { userId: authUser.id });
        return;
      }

      // Do NOT re-check whitelist on session restore — user already passed it at login.
      // Whitelist is only checked at TMWE OAuth callback.
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
      log.warn("[useAuthV2] loadUserData non-critical error:", { error: err });
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

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Network error — clear local session anyway
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-"))
          .forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
    }
    setProfile(null);
    setRoles([]);
    window.location.href = "/auth";
  }, []);

  return {
    user, session, profile, roles,
    isLoading, isAuthenticated, isAdmin,
    signOut,
  };
}
