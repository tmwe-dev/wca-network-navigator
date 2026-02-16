import { Coins, TrendingDown } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_TIERS } from "@/config/subscriptionTiers";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CreditCounter() {
  const { balance, totalConsumed, loading } = useCredits();
  const { tier } = useSubscription();

  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const monthlyAllocation = tierConfig.limits.ai_credits_included;

  if (loading) return null;

  // Estimate cost: ~1 credit ≈ €0.01 (rough avg across providers)
  const estimatedCost = (totalConsumed * 0.01).toFixed(2);

  const isLow = balance <= 50 && balance > 0;
  const isEmpty = balance <= 0;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-default",
            isEmpty
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : isLow
              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-border bg-muted/50 text-foreground"
          )}
        >
          <Coins className="w-4 h-4 flex-shrink-0" />
          <span className="tabular-nums">{balance.toLocaleString()}</span>
          {totalConsumed > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingDown className="w-3 h-3" />
                {totalConsumed.toLocaleString()}
              </span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p className="font-semibold">Crediti AI — Piano {tierConfig.name}</p>
          <p>Saldo: <strong>{balance.toLocaleString()}</strong> crediti</p>
          <p>Consumati questo mese: <strong>{totalConsumed.toLocaleString()}</strong> (~€{estimatedCost})</p>
          {monthlyAllocation > 0 && (
            <p>Ricarica mensile: {monthlyAllocation.toLocaleString()} crediti</p>
          )}
          <p className="text-muted-foreground pt-1">I crediti extra non utilizzati si azzerano a fine mese.</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
