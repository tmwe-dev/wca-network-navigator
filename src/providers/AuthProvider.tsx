/**
 * useAuth — Lightweight auth hook (replaces AuthProvider).
 * Subscribes directly to supabase.auth without needing a Context/Provider wrapper.
 * Module-level singleton: all useAuth() calls share ONE listener.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  readonly session: Session | null;
  readonly user: User | null;
  readonly status: AuthStatus;
  readonly event: AuthChangeEvent | null;
}

// ── Singleton store ──────────────────────────────────────────────────

let _snapshot: AuthContextValue = {
  session: null,
  user: null,
  status: "loading",
  event: null,
};

const _listeners = new Set<() => void>();
let _subscribed = false;

function notify() {
  _listeners.forEach((l) => l());
}

function updateSnapshot(
  session: Session | null,
  event: AuthChangeEvent | null,
) {
  _snapshot = {
    session,
    user: session?.user ?? null,
    status: session ? "authenticated" : "unauthenticated",
    event: event ?? _snapshot.event,
  };
  notify();
}

function ensureSubscription() {
  if (_subscribed) return;
  _subscribed = true;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (authEvent, currentSession) => {
      updateSnapshot(currentSession, authEvent);
    },
  );

  // Bootstrap
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (_snapshot.status === "loading") {
      updateSnapshot(session, null);
    }
  }).catch(() => {
    if (_snapshot.status === "loading") {
      updateSnapshot(null, null);
    }
  });

  // Keep subscription reference to prevent GC (intentionally never unsubscribe — app-level singleton)
  void subscription;
}

function subscribe(cb: () => void) {
  ensureSubscription();
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

function getSnapshot(): AuthContextValue {
  return _snapshot;
}

/**
 * Hook to consume auth state. Drop-in replacement for the old AuthProvider's useAuth().
 * No Provider needed — uses a module-level singleton.
 */
export function useAuth(): AuthContextValue {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
