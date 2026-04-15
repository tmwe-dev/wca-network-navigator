/**
 * useAuth — Stubbed: auth removed, always returns authenticated.
 */
import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  readonly session: Session | null;
  readonly user: User | null;
  readonly status: AuthStatus;
  readonly event: AuthChangeEvent | null;
}

const _snapshot: AuthContextValue = {
  session: null,
  user: null,
  status: "authenticated",
  event: null,
};

export function useAuth(): AuthContextValue {
  return _snapshot;
}
