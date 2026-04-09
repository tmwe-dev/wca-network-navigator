import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewingAll, setViewingAllState] = useState(false);

  // Default to current user's operator
  useEffect(() => {
    if (!activeId && currentOp?.id) {
      setActiveId(currentOp.id);
    }
  }, [currentOp, activeId]);

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

  return (
    <Ctx.Provider value={{
      operators,
      activeOperator,
      setActiveOperatorId: handleSetActiveId,
      isLoading: loadingOps || loadingCurrent,
      viewingAll,
      isImpersonating,
      setViewingAll: handleSetViewingAll,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useActiveOperator = () => useContext(Ctx);
