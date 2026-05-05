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

export function ActiveOperatorProvider({ children }: { children: ReactNode }) {
  const { data: operators = [], isLoading: loadingOps } = useOperators();
  const { data: currentOp, isLoading: loadingCurrent } = useCurrentOperator();
  const STORAGE_KEY = "activeOperator:v1";
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { activeId: string | null; viewingAll: boolean };
      return parsed.viewingAll ? null : parsed.activeId;
    } catch { return null; }
  });
  const [viewingAll, setViewingAllState] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { viewingAll: boolean };
      return Boolean(parsed.viewingAll);
    } catch { return false; }
  });

  // Default to current user's operator only if nothing was persisted
  useEffect(() => {
    if (!activeId && !viewingAll && currentOp?.id) {
      setActiveId(currentOp.id);
    }
  }, [currentOp, activeId, viewingAll]);

  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, viewingAll }));
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
