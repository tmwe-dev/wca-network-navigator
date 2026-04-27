/**
 * EmailIntelligenceHeader — Header compatto top-of-tab.
 *
 * Layout: [↻ Refresh] ............................. [+ Nuovo gruppo]
 * La ricerca mittente è fuori (sopra il rail card) per ottimizzare lo spazio.
 */
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, RefreshCw, Loader2 } from "lucide-react";

interface EmailIntelligenceHeaderProps {
  onCreateGroup: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function EmailIntelligenceHeader({
  onCreateGroup,
  onRefresh,
  isRefreshing = false,
}: EmailIntelligenceHeaderProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRefresh && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Aggiorna mittenti"
                className="h-8 w-8"
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aggiorna mittenti dal server</TooltipContent>
          </Tooltip>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCreateGroup} className="h-8">
          <Plus className="h-4 w-4 mr-1" />
          Nuovo gruppo
        </Button>
      </div>
    </TooltipProvider>
  );
}
