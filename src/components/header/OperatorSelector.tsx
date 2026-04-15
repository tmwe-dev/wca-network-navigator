import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export function OperatorSelector() {
  const { operators, activeOperator, setActiveOperatorId, viewingAll, isImpersonating, setViewingAll } = useActiveOperator();

  // Always visible, no admin gate
  if (operators.length === 0) return null;

  const activeOps = operators.filter(o => o.is_active);
  const currentValue = viewingAll ? "__all__" : (activeOperator?.id || "");

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={currentValue}
        onValueChange={(val) => {
          if (val === "__all__") {
            setViewingAll();
          } else {
            setActiveOperatorId(val);
          }
        }}
      >
        <SelectTrigger className={cn(
          "w-[200px] h-8 text-xs gap-1.5 transition-all",
          isImpersonating && "border-orange-400/60 bg-orange-50/30 dark:bg-orange-950/20",
          viewingAll && "border-primary/40 bg-primary/5"
        )}>
          <Shield className="w-3.5 h-3.5 shrink-0 text-primary" />
          <SelectValue placeholder="Seleziona operatore..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__" className="text-xs">
            <div className="flex items-center gap-2">
              <Eye className="w-3 h-3" />
              <span className="font-semibold">Tutti gli operatori</span>
            </div>
          </SelectItem>
          {activeOps.map(op => (
            <SelectItem key={op.id} value={op.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{op.name}</span>
                <span className="text-muted-foreground text-[10px]">{op.email}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isImpersonating && activeOperator && (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium whitespace-nowrap">
          Viewing: {activeOperator.name}
        </span>
      )}
    </div>
  );
}
