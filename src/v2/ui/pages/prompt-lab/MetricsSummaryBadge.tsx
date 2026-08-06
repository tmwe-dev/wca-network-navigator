/**
 * MetricsSummaryBadge — Badge inline per visualizzare tasso accettazione.
 *
 * Mostra acceptance_rate come badge colorato:
 * - Verde (>70%): "excellent"
 * - Ambra (40-70%): "good/moderate"
 * - Rosso (<40%): "poor"
 *
 * Carica metriche al mount e aggiorna ogni X secondi.
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getMetricsSummary, type MetricsSummary } from "@/data/promptLabMetrics";
import { useAuth } from "@/providers/AuthProvider";


import { createLogger } from "@/lib/log";
const log = createLogger("MetricsSummaryBadge");
export function MetricsSummaryBadge() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    // Carica metriche all'avvio
    const loadMetrics = async () => {
      try {
        const s = await getMetricsSummary(user.id);
        setSummary(s);
      } catch (e) {
        log.error("[MetricsSummaryBadge] Errore caricamento metriche:", { error: e });
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();

    // Aggiorna ogni 30s
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (loading || !summary) {
    return null;
  }

  // Colore basato su status
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (summary.status === "excellent") {
    variant = "default"; // Verde (default è spesso verde/blu)
  } else if (summary.status === "good" || summary.status === "moderate") {
    variant = "secondary"; // Ambra
  } else if (summary.status === "poor") {
    variant = "destructive"; // Rosso
  }

  return (
    <Badge variant={variant} className="text-xs whitespace-nowrap">
      {summary.acceptance_rate}% accettazione
    </Badge>
  );
}
