/**
 * AuthProvider — Single centralized onAuthStateChange listener.
 *
 * Every component/hook that needs auth state MUST use the useAuth() hook
 * exported from this module instead of calling supabase.auth directly.
 */
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  readonly session: Session | null;
  readonly user: User | null;
  readonly status: AuthStatus;
  /** Last auth event emitted by Supabase (useful for PASSWORD_RECOVERY, TOKEN_REFRESHED, etc.) */
  readonly event: AuthChangeEvent | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearSupabaseAuthStorage() {
  try {
    const authKeys = Object.keys(localStorage).filter(
      (key) => (key.includes("supabase") || key.startsWith("sb-")) && key.includes("auth"),
    );
    authKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // local cleanup only — best effort
  }
}

function hasValidAccessToken(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;

  const parts = accessToken.split(".");
  if (parts.length !== 3) return false;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { sub?: unknown; exp?: unknown };

    if (typeof payload.sub !== "string" || payload.sub.length === 0) return false;
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [event, setEvent] = useState<AuthChangeEvent | null>(null);
  const initialised = useRef(false);

  const setUnauthenticated = useCallback(() => {
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const applyValidatedSession = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setUnauthenticated();
      return;
    }

    // Trust the local JWT if it has a valid structure and isn't expired
    if (!currentSession.user?.id || !hasValidAccessToken(currentSession.access_token)) {
      clearSupabaseAuthStorage();
      await supabase.auth.signOut({ scope: "local" });
      setUnauthenticated();
      return;
    }

    // Session JWT is valid — authenticate immediately without network call.
    // getUser() was causing sign-outs when the DB returned 503.
    setSession(currentSession);
    setUser(currentSession.user);
    setStatus("authenticated");
  }, [setUnauthenticated]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (authEvent, currentSession) => {
        if (!mounted) return;
        setEvent(authEvent);

        void applyValidatedSession(currentSession);
      },
    );

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mounted || initialised.current) return;
      initialised.current = true;
      void applyValidatedSession(initial);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyValidatedSession]);

  return (
    <AuthContext.Provider value={{ session, user, status, event }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume auth state from the centralized AuthProvider.
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}
