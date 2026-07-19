import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useOperators, useCurrentOperator, type Operator } from "@/hooks/useOperators";
import { useAuth } from "@/providers/AuthProvider";

type ActiveOperatorCtx = {
  operators: Operator[];
  activeOperator: Operator | null;
  setActiveOperatorId: (id: string) => void;
  isLoading: boolean;
  viewingAll: boolean;
  isImpersonating: boolean;
  setViewingAll: () => void;
};

const Ctx = createContext<ActiveOperatorCtx>({
  operators: [],
  activeOperator: null,
  setActiveOperatorId: () => {},
  isLoading: true,
  viewingAll: false,
  isImpersonating: false,
  setViewingAll: () => {},
});

// v2: chiave per-user. Evita che la selezione di un account "contagi"
// chi accede dopo dallo stesso browser.
const STORAGE_KEY_PREFIX = "activeOperator:v2:";
const LEGACY_STORAGE_KEY = "activeOperator:v1";
const storageKeyFor = (userId: string | null) =>
  userId ? `${STORAGE_KEY_PREFIX}${userId}` : null;

type Persisted = { activeId: string | null; viewingAll: boolean };

function readPersisted(userId: string | null): Persisted {
  const key = storageKeyFor(userId);
  if (typeof window === "undefined" || !key) return { activeId: null, viewingAll: false };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { activeId: null, viewingAll: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
      viewingAll: Boolean(parsed.viewingAll),
    };
  } catch {
    return { activeId: null, viewingAll: false };
  }
}

export function ActiveOperatorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: operators = [], isLoading: loadingOps } = useOperators();
  const { data: currentOp, isLoading: loadingCurrent } = useCurrentOperator();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewingAll, setViewingAllState] = useState<boolean>(false);

  // Quando cambia l'utente loggato (login/logout/swap), ripuliamo lo stato
  // in memoria e ricarichiamo lo storage SCOPED per quel user.id.
  // Bonifica anche la chiave legacy globale, se presente, così non sopravvive
  // tra account diversi.
  useEffect(() => {
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(LEGACY_STORAGE_KEY); } catch { /* ignore */ }
    }
    if (!userId) {
      setActiveId(null);
      setViewingAllState(false);
      return;
    }
    const persisted = readPersisted(userId);
    setActiveId(persisted.viewingAll ? null : persisted.activeId);
    setViewingAllState(persisted.viewingAll);
  }, [userId]);

  // Default all'operatore dell'utente corrente se nulla di persistito.
  useEffect(() => {
    if (!userId) return;
    if (activeId || viewingAll) return;
    const persisted = readPersisted(userId);
    if (persisted.activeId || persisted.viewingAll) return;
    if (currentOp?.id) setActiveId(currentOp.id);
  }, [userId, currentOp, activeId, viewingAll]);

  // Persist selection
  useEffect(() => {
    const key = storageKeyFor(userId);
    if (!key) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify({ activeId, viewingAll }));
      }
    } catch { /* ignore */ }
  }, [userId, activeId, viewingAll]);

  const handleSetActiveId = (id: string) => {
    setViewingAllState(false);
    setActiveId(id);
  };

  const handleSetViewingAll = () => {
    setViewingAllState(true);
    setActiveId(null);
  };

  // Hard guard: se l'activeId persistito non corrisponde a NESSUN operatore
  // accessibile dall'utente corrente (es. id "fantasma" di un altro account),
  // ricadiamo sull'operatore proprio. Mai su un id sconosciuto.
  const resolvedActive = activeId ? operators.find(o => o.id === activeId) ?? null : null;
  const activeOperator = viewingAll
    ? null
    : resolvedActive ?? currentOp ?? null;

  const isImpersonating = !viewingAll && activeOperator != null && currentOp != null && activeOperator.id !== currentOp.id;

  const ctxValue = useMemo(() => ({
    operators,
    activeOperator,
    setActiveOperatorId: handleSetActiveId,
    isLoading: loadingOps || loadingCurrent,
    viewingAll,
    isImpersonating,
    setViewingAll: handleSetViewingAll,
  }), [operators, activeOperator, loadingOps, loadingCurrent, viewingAll, isImpersonating]);

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
    </Ctx.Provider>
  );
}

export const useActiveOperator = () => useContext(Ctx);
