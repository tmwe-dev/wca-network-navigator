/**
 * TokenUsageCounter — Compact token usage display in header
 * Shows today's usage / limit with progress bar and color coding
 * Dropdown with detailed breakdown
 */
import { useState } from "react";
import { useTokenUsage } from "@/hooks/useTokenUsage";
import { formatTokenCount, getFunctionDisplayName } from "@/data/tokenUsage";
import { getUsageByFunction } from "@/data/tokenUsage";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/v2/ui/atoms/Button";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface TokenUsageCounterProps {
  className?: string;
}

export function TokenUsageCounter({ className }: TokenUsageCounterProps) {
  const navigate = useNavigate();
  const { data: tokenUsage, isLoading } = useTokenUsage();
  const [functionBreakdown, setFunctionBreakdown] = useState<Record<string, number>>({});
  const [showDropdown, setShowDropdown] = useState(false);

  // Load function breakdown when dropdown opens
  const handleOpenChange = async (open: boolean) => {
    setShowDropdown(open);
    if (open) {
      try {
        const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
        if (user) {
          const breakdown = await getUsageByFunction(user.id, 7);
          setFunctionBreakdown(breakdown);
        }
      } catch (error) {
        console.error("Error loading function breakdown:", error);
      }
    }
  };

  if (isLoading || !tokenUsage) {
    return null;
  }

  const { todayTokens, dailyLimit, dailyPercentage } = tokenUsage;

  // Color coding based on percentage
  let statusColor = "emerald"; // green (<60%)
  if (dailyPercentage >= 85) {
    statusColor = "red"; // red (>85%)
  } else if (dailyPercentage >= 60) {
    statusColor = "amber"; // yellow (60-85%)
  }

  const barColor = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  }[statusColor];

  const bgColor = {
    emerald: "bg-emerald-500/10",
    amber: "bg-amber-500/10",
    red: "bg-red-500/10",
  }[statusColor];

  const textColor = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
  }[statusColor];

  return (
    <DropdownMenu open={showDropdown} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "h-7 px-2 flex items-center gap-2 rounded-lg transition-all text-[10px] font-semibold",
            bgColor,
            textColor,
            "hover:opacity-80",
            className
          )}
          aria-label="Token usage"
        >
          <Zap className="w-3 h-3" />
          <span>
            {formatTokenCount(todayTokens)} / {formatTokenCount(dailyLimit)}
          </span>
          <div className="w-8 h-1.5 bg-black/20 rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all", barColor)}
              style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
            />
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          {/* Today usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Oggi</span>
              <span className="text-xs font-semibold">
                {formatTokenCount(todayTokens)} / {formatTokenCount(dailyLimit)}
              </span>
            </div>
            <Progress
              value={Math.min(dailyPercentage, 100)}
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(dailyPercentage)}% di limite giornaliero
            </p>
          </div>

          <DropdownMenuSeparator />

          {/* Month usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Questo mese</span>
              <span className="text-xs font-semibold">
                {formatTokenCount(tokenUsage.monthTokens)} / {formatTokenCount(tokenUsage.monthlyLimit)}
              </span>
            </div>
            <Progress
              value={Math.min(tokenUsage.monthlyPercentage, 100)}
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(tokenUsage.monthlyPercentage)}% di limite mensile
            </p>
          </div>

          <DropdownMenuSeparator />

          {/* Function breakdown */}
          {Object.keys(functionBreakdown).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Utilizzo per funzione (ultimi 7 giorni)
              </p>
              <div className="space-y-2">
                {Object.entries(functionBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([funcName, tokens]) => (
                    <div key={funcName} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {getFunctionDisplayName(funcName)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {formatTokenCount(tokens)}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <DropdownMenuSeparator />

          {/* Settings link */}
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs h-7"
            onClick={() => {
              setShowDropdown(false);
              navigate("/v2/ai-control-center#token-settings");
            }}
          >
            Configurazione token
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
