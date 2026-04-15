/**
 * useAuth — Lightweight auth hook (replaces AuthProvider).
 * Subscribes directly to supabase.auth without needing a Context/Provider wrapper.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User, AuthChangeEvent } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  readonly session: Session | null;
  readonly user: User | null;
  readonly status: AuthStatus;
  readonly event: AuthChangeEvent | null;
}

// ── Singleton store so multiple useAuth() calls share ONE listener ────

let _session: Session | null = null;
let _user: User | null = null;
let _status: AuthStatus = "loading";
let _event: AuthChangeEvent | null = null;
let _listeners = new Set<() => void>();
let _subscribed = false;

function notify() {
  _listeners.forEach((l) => l());
}

function ensureSubscription() {
  if (_subscribed) return;
  _subscribed = true;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (authEvent, currentSession) => {
      _event = authEvent;
      _session = currentSession;
      _user = currentSession?.user ?? null;
      _status = currentSession ? "authenticated" : "unauthenticated";
      notify();
    },
  );

  // Bootstrap
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (_status === "loading") {
      _session = session;
      _user = session?.user ?? null;
      _status = session ? "authenticated" : "unauthenticated";
      notify();
    }
  }).catch(() => {
    if (_status === "loading") {
      _status = "unauthenticated";
      notify();
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
  return { session: _session, user: _user, status: _status, event: _event };
}

/**
 * Hook to consume auth state. Drop-in replacement for the old AuthProvider's useAuth().
 * No Provider needed — uses a module-level singleton.
 */
export function useAuth(): AuthContextValue {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
