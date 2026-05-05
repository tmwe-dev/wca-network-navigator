import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useOperators, useCurrentOperator, type Operator } from "@/hooks/useOperators";

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

const STORAGE_KEY = "activeOperator:v1";

type Persisted = { activeId: string | null; viewingAll: boolean };

function readPersisted(): Persisted {
  if (typeof window === "undefined") return { activeId: null, viewingAll: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  const { data: operators = [], isLoading: loadingOps } = useOperators();
  const { data: currentOp, isLoading: loadingCurrent } = useCurrentOperator();
  const initial = readPersisted();
  const [activeId, setActiveId] = useState<string | null>(initial.viewingAll ? null : initial.activeId);
  const [viewingAll, setViewingAllState] = useState<boolean>(initial.viewingAll);

  // Default to current user's operator solo se non c'è nulla di persistito
  // E non siamo in modalità "tutti".
  useEffect(() => {
    if (activeId || viewingAll) return;
    const persisted = readPersisted();
    if (persisted.activeId || persisted.viewingAll) return;
    if (currentOp?.id) setActiveId(currentOp.id);
  }, [currentOp, activeId, viewingAll]);

  // Persist selection
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, viewingAll }));
      }
    } catch { /* ignore */ }
  }, [activeId, viewingAll]);

  const handleSetActiveId = (id: string) => {
    setViewingAllState(false);
    setActiveId(id);
  };

  const handleSetViewingAll = () => {
    setViewingAllState(true);
    setActiveId(null);
  };

  const activeOperator = viewingAll
    ? null
    : activeId
      ? operators.find(o => o.id === activeId) || currentOp || null
      : currentOp || null;

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
