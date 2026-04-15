import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fullscreen overlay that forces operator selection before using the app.
 */
export function OperatorSelectionOverlay() {
  const { operators, setActiveOperatorId, requiresSelection, isLoading } = useActiveOperator();

  if (!requiresSelection) return null;

  const activeOps = operators.filter(o => o.is_active);

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">WCA Network Navigator</h1>
          <p className="text-muted-foreground mt-2">Seleziona il tuo operatore per continuare</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : activeOps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun operatore disponibile.</p>
        ) : (
          <div className="space-y-2">
            {activeOps.map(op => (
              <Button
                key={op.id}
                variant="outline"
                className="w-full justify-start gap-3 h-12 text-left"
                onClick={() => setActiveOperatorId(op.id)}
              >
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-sm">{op.name}</span>
                  {op.email && <span className="text-xs text-muted-foreground">{op.email}</span>}
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
