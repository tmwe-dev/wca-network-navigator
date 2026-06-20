/**
 * CostControlPanel — Controllo costi AI in un solo posto.
 *
 *  - Toggle "Analisi profonda mail in arrivo" (scout web + enrichment LLM su ogni
 *    mail da mittente sconosciuto). Default OFF: si attiva solo se richiesto.
 *  - Sintesi consumi del giorno (chiamate + costo stimato) da ai_prompt_log.
 *
 * Setting: app_settings.ai_deep_mail_analysis_enabled = "true" | "false"
 */
import { useMemo } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DEEP_KEY = "ai_deep_mail_analysis_enabled";

interface TodayRow {
  function_name: string;
  calls: number;
  cost: number;
}

export function CostControlPanel() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const deepEnabled = settings?.[DEEP_KEY] === "true";

  const { data: today } = useQuery({
    queryKey: ["cost-control", "today-usage"],
    queryFn: async (): Promise<{ rows: TodayRow[]; totalCalls: number; totalCost: number }> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("ai_prompt_log")
        .select("function_name, cost_usd")
        .gte("created_at", start.toISOString())
        .limit(5000);
      if (error) throw error;
      const acc: Record<string, TodayRow> = {};
      let totalCalls = 0;
      let totalCost = 0;
      for (const r of data ?? []) {
        const fn = (r.function_name as string) || "unknown";
        const cost = Number(r.cost_usd) || 0;
        acc[fn] = acc[fn] || { function_name: fn, calls: 0, cost: 0 };
        acc[fn].calls += 1;
        acc[fn].cost += cost;
        totalCalls += 1;
        totalCost += cost;
      }
      const rows = Object.values(acc).sort((a, b) => b.cost - a.cost || b.calls - a.calls);
      return { rows, totalCalls, totalCost };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const topRows = useMemo(() => (today?.rows ?? []).slice(0, 8), [today]);

  const handleToggle = (checked: boolean) => {
    updateSetting.mutate(
      { key: DEEP_KEY, value: checked ? "true" : "false" },
      {
        onSuccess: () =>
          toast.success(
            checked
              ? "Analisi profonda mail ATTIVATA"
              : "Analisi profonda mail DISATTIVATA",
          ),
        onError: () => toast.error("Impossibile salvare l'impostazione"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Analisi profonda mail in arrivo
          </CardTitle>
          <CardDescription>
            Quando attiva, l'AI fa ricerca web sul mittente e arricchimento su ogni
            mail da indirizzi sconosciuti. È il principale consumo di crediti non
            controllato: tienila spenta e attivala solo quando ti serve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {deepEnabled ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              )}
              <div>
                <p className="font-medium">
                  {deepEnabled ? "Attiva — consuma crediti su ogni mail" : "Disattivata — risparmio attivo"}
                </p>
                <p className="text-sm text-muted-foreground">
                  La classificazione base delle mail resta sempre attiva.
                </p>
              </div>
            </div>
            <Switch
              checked={deepEnabled}
              disabled={isLoading || updateSetting.isPending}
              onCheckedChange={handleToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Consumo di oggi
          </CardTitle>
          <CardDescription>
            {today
              ? `${today.totalCalls} chiamate AI · costo stimato $${today.totalCost.toFixed(2)}`
              : "Caricamento…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna chiamata registrata oggi.</p>
          ) : (
            <div className="space-y-2">
              {topRows.map((r) => (
                <div key={r.function_name} className="flex items-center justify-between text-sm">
                  <span className="font-mono truncate">{r.function_name}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{r.calls} call</Badge>
                    <span className="tabular-nums text-muted-foreground">${r.cost.toFixed(3)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
