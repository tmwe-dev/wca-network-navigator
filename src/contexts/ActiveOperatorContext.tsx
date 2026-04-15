import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useOperators, type Operator } from "@/hooks/useOperators";

type ActiveOperatorCtx = {
  operators: Operator[];
  activeOperator: Operator | null;
  setActiveOperatorId: (id: string) => void;
  isLoading: boolean;
  viewingAll: boolean;
  isImpersonating: boolean;
  setViewingAll: () => void;
  requiresSelection: boolean;
};

const Ctx = createContext<ActiveOperatorCtx>({
  operators: [],
  activeOperator: null,
  setActiveOperatorId: () => {},
  isLoading: true,
  viewingAll: false,
  isImpersonating: false,
  setViewingAll: () => {},
  requiresSelection: true,
});

export function ActiveOperatorProvider({ children }: { children: ReactNode }) {
  const { data: operators = [], isLoading: loadingOps } = useOperators();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewingAll, setViewingAllState] = useState(false);

  // No auto-select — user must choose

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
      ? operators.find(o => o.id === activeId) || null
      : null;

  const requiresSelection = !loadingOps && !viewingAll && activeOperator === null;

  const ctxValue = useMemo(() => ({
    operators,
    activeOperator,
    setActiveOperatorId: handleSetActiveId,
    isLoading: loadingOps,
    viewingAll,
    isImpersonating: false,
    setViewingAll: handleSetViewingAll,
    requiresSelection,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [operators, activeOperator, loadingOps, viewingAll, requiresSelection]);

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
    </Ctx.Provider>
  );
}

export const useActiveOperator = () => useContext(Ctx);
