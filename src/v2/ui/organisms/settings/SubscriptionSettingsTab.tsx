/**
 * SubscriptionSettingsTab — Credits + transaction history
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "../../organisms/FormSection";
import { Loader2, Crown } from "lucide-react";
import { format } from "date-fns";
import { queryKeys } from "@/lib/queryKeys";

export function SubscriptionSettingsTab(): React.ReactElement {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.v2.creditTransactions,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { balance: 0, transactions: [] };

      const { data: txs } = await supabase
        .from("credit_transactions")
        .select("id, amount, operation, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const items = txs ?? [];
      const balance = items.reduce((s, t) => s + t.amount, 0);
      return { balance, transactions: items };
    },
  });

  return (
    <div className="space-y-6">
      <FormSection title="Abbonamento e Crediti" description="Saldo crediti e storico transazioni.">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-md border bg-primary/5">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{data?.balance?.toLocaleString("it-IT") ?? 0}</p>
                <p className="text-xs text-muted-foreground">Crediti disponibili</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Storico transazioni</p>
              {data?.transactions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna transazione.</p>
              ) : (
                <div className="space-y-1">
                  {data?.transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 p-2 rounded border text-xs">
                      <span className={`font-mono font-semibold ${tx.amount >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount}
                      </span>
                      <span className="flex-1 text-foreground truncate">{tx.description ?? tx.operation}</span>
                      <span className="text-muted-foreground">{format(new Date(tx.created_at), "dd/MM HH:mm")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </FormSection>
    </div>
  );
}
