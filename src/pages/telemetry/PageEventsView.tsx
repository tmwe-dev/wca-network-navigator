import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { PageEventRow } from "./types";
import { fmtTime, aggregateBy } from "./utils";
import { KpiCard, Card, SkeletonRows, ErrorBox, EmptyTelemetry } from "./SharedUI";

export function PageEventsView({ sinceIso }: { sinceIso: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["telemetry-page-events", sinceIso],
    queryFn: async () => {
      const { data, error } = await untypedFrom("page_events")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PageEventRow[];
    },
    refetchInterval: 30_000,
  });

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading) return <SkeletonRows />;
  if (!data?.length) return <EmptyTelemetry label="Nessun evento nel periodo selezionato" />;

  const total = data.length;
  const uniquePages = new Set(data.map((d) => d.page)).size;
  const uniqueSessions = new Set(data.map((d) => d.session_id).filter(Boolean)).size;
  const topPages = aggregateBy(data, "page").slice(0, 5);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Eventi totali" value={total.toLocaleString("it-IT")} />
        <KpiCard label="Pagine distinte" value={String(uniquePages)} />
        <KpiCard label="Sessioni" value={String(uniqueSessions)} />
      </div>

      <Card title="Top pagine">
        <ul className="text-sm divide-y divide-border">
          {topPages.map((p) => (
            <li key={p.key} className="flex items-center justify-between py-2">
              <span className="font-mono text-xs text-foreground">{p.key}</span>
              <span className="text-xs text-muted-foreground">{p.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Eventi recenti (${data.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Quando</th>
                <th>Evento</th>
                <th>Pagina</th>
                <th>Entità</th>
                <th>Durata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.slice(0, 100).map((e) => (
                <tr key={e.id} className="hover:bg-muted/50">
                  <td className="py-1.5 text-muted-foreground whitespace-nowrap">{fmtTime(e.created_at)}</td>
                  <td className="font-medium">{e.event_name}</td>
                  <td className="font-mono text-muted-foreground">{e.page}</td>
                  <td className="text-muted-foreground">
                    {e.entity_type ? `${e.entity_type}:${e.entity_id?.slice(0, 8)}` : "—"}
                  </td>
                  <td className="text-muted-foreground">{e.duration_ms ? `${e.duration_ms}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
