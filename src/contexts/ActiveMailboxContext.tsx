/**
 * ActiveMailboxContext — quale casella di posta sta usando l'operatore corrente.
 * Default: la propria casella personale. Per-operatore in localStorage.
 * Le pagine email (Funnemail, Inbox, Compose) leggono `useActiveMailbox()` per filtrare/inviare.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listAccessibleMailboxes, type AccessibleMailbox } from "@/data/mailboxes";
import { useCurrentOperator } from "@/hooks/useOperators";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/AuthProvider";

interface Ctx {
  mailboxes: AccessibleMailbox[];
  activeMailbox: AccessibleMailbox | null;
  setActiveMailboxId: (id: string) => void;
  isLoading: boolean;
}

const Context = React.createContext<Ctx>({
  mailboxes: [],
  activeMailbox: null,
  setActiveMailboxId: () => undefined,
  isLoading: false,
});

// v2: lo storage è scoped sia per user.id che per operator.id, così la
// scelta della casella di un account non contamina un altro login sullo
// stesso browser, e l'admin che impersona vede la mailbox dell'impersonato.
const STORAGE_KEY_PREFIX = "lov:active-mailbox:v2:";

export function ActiveMailboxProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: currentOp } = useCurrentOperator();
  const opId = currentOp?.id ?? null;

  const { data: mailboxes = [], isLoading } = useQuery({
    // Cache per user.id + operator.id: nessun riutilizzo cross-account.
    queryKey: [...queryKeys.email.mailboxes, userId, opId],
    // Passiamo l'operator id esplicito alla RPC: niente fallback implicito
    // ad auth.uid() che, in caso di cache stale, mostrerebbe le mailbox
    // dell'utente sbagliato.
    queryFn: () => listAccessibleMailboxes(opId ?? undefined),
    enabled: !!userId && !!opId,
    staleTime: 60_000,
  });

  const storageKey = userId && opId ? `${STORAGE_KEY_PREFIX}${userId}:${opId}` : null;

  const [activeId, setActiveId] = React.useState<string | null>(() => {
    if (typeof window === "undefined" || !storageKey) return null;
    return window.localStorage.getItem(storageKey);
  });

  React.useEffect(() => {
    if (!storageKey) return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) setActiveId(stored);
  }, [storageKey]);

  const activeMailbox = React.useMemo<AccessibleMailbox | null>(() => {
    if (!mailboxes.length) return null;
    if (activeId) {
      const found = mailboxes.find((m) => m.mailbox_id === activeId);
      if (found) return found;
    }
    return mailboxes.find((m) => m.kind === "personal") ?? mailboxes[0];
  }, [mailboxes, activeId]);

  const setActiveMailboxId = React.useCallback(
    (id: string) => {
      setActiveId(id);
      if (storageKey) window.localStorage.setItem(storageKey, id);
    },
    [storageKey],
  );

  const value = React.useMemo<Ctx>(
    () => ({ mailboxes, activeMailbox, setActiveMailboxId, isLoading }),
    [mailboxes, activeMailbox, setActiveMailboxId, isLoading],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useActiveMailbox = () => React.useContext(Context);