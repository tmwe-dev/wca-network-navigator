import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useOperators, useCurrentOperator, type Operator } from "@/hooks/useOperators";

type ActiveOperatorCtx = {
  operators: Operator[];
  activeOperator: Operator | null;
  setActiveOperatorId: (id: string) => void;
  isLoading: boolean;
};

const Ctx = createContext<ActiveOperatorCtx>({
  operators: [],
  activeOperator: null,
  setActiveOperatorId: () => {},
  isLoading: true,
});

export function ActiveOperatorProvider({ children }: { children: ReactNode }) {
  const { data: operators = [], isLoading: loadingOps } = useOperators();
  const { data: currentOp, isLoading: loadingCurrent } = useCurrentOperator();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Default to current user's operator
  useEffect(() => {
    if (!activeId && currentOp?.id) {
      setActiveId(currentOp.id);
    }
  }, [currentOp, activeId]);

  const activeOperator = activeId
    ? operators.find(o => o.id === activeId) || currentOp || null
    : currentOp || null;

  return (
    <Ctx.Provider value={{
      operators,
      activeOperator,
      setActiveOperatorId: setActiveId,
      isLoading: loadingOps || loadingCurrent,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useActiveOperator = () => useContext(Ctx);
