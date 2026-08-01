/**
 * AuthLifecycle — purge per-user state when the authenticated user.id changes
 * or on SIGNED_OUT. Mounted once inside the QueryClientProvider tree.
 *
 * Risolve il leak cross-account: se Luigi e Luca usano lo stesso browser,
 * il cache TanStack e le chiavi localStorage operator/mailbox del precedente
 * non devono sopravvivere al login del successivo.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";

const PER_USER_STORAGE_PREFIXES = [
  "activeOperator:v2:",
  "lov:active-mailbox:v2:",
];
const LEGACY_STORAGE_KEYS = [
  "activeOperator:v1",
];

function purgePerUserStorage(keepUserId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    LEGACY_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
    const toDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const matchedPrefix = PER_USER_STORAGE_PREFIXES.find((p) => key.startsWith(p));
      if (!matchedPrefix) continue;
      const rest = key.slice(matchedPrefix.length);
      const ownerId = rest.split(":")[0] ?? "";
      if (keepUserId && ownerId === keepUserId) continue;
      toDelete.push(key);
    }
    toDelete.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* best effort */
  }
}

export function AuthLifecycle(): null {
  const qc = useQueryClient();
  const { user, status } = useAuth();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const currentId = user?.id ?? null;
    const prev = lastUserId.current;
    if (prev === currentId) return;

    // L'utente è cambiato (login, logout, swap account):
    // 1) clear COMPLETO del cache TanStack — nessun dato del precedente
    //    può sopravvivere agli hook che ora gireranno per il nuovo user.id.
    // 2) bonifica delle chiavi localStorage scoped per user che NON
    //    appartengono all'utente corrente.
    qc.clear();
    purgePerUserStorage(currentId);
    lastUserId.current = currentId;
  }, [qc, user?.id, status]);

  return null;
}
