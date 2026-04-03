import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "lucide-react";

export function OperatorSelector() {
  const { operators, activeOperator, setActiveOperatorId } = useActiveOperator();

  if (operators.length <= 1) return null;

  return (
    <Select
      value={activeOperator?.id || ""}
      onValueChange={setActiveOperatorId}
    >
      <SelectTrigger className="w-[180px] h-8 text-xs gap-1.5">
        <User className="w-3.5 h-3.5 shrink-0" />
        <SelectValue placeholder="Operatore..." />
      </SelectTrigger>
      <SelectContent>
        {operators.filter(o => o.is_active).map(op => (
          <SelectItem key={op.id} value={op.id} className="text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium">{op.name}</span>
              <span className="text-muted-foreground">{op.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
