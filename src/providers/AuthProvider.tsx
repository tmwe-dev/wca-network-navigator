/**
 * AuthProvider — Single centralized onAuthStateChange listener.
 *
 * Every component/hook that needs auth state MUST use the useAuth() hook
 * exported from this module instead of calling supabase.auth directly.
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [event, setEvent] = useState<AuthChangeEvent | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Single listener for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (authEvent, currentSession) => {
        if (!mounted) return;
        setEvent(authEvent);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setStatus(currentSession ? "authenticated" : "unauthenticated");
      },
    );

    // Bootstrap: read the existing session once
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mounted || initialised.current) return;
      initialised.current = true;
      setSession(initial);
      setUser(initial?.user ?? null);
      setStatus(initial ? "authenticated" : "unauthenticated");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
