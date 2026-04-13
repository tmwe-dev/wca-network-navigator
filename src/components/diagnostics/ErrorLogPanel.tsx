import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const ERROR_TYPES = ["all", "react_crash", "edge_function", "unhandled_rejection", "js_error"] as const;

const typeColors: Record<string, string> = {
  react_crash: "bg-destructive/20 text-destructive",
  edge_function: "bg-orange-500/20 text-orange-400",
  unhandled_rejection: "bg-yellow-500/20 text-yellow-400",
  js_error: "bg-red-500/20 text-red-400",
};

export function ErrorLogPanel() {
  const [filterType, setFilterType] = useState<string>("all");

  const { data: errors, refetch } = useQuery({
    queryKey: ["error-logs", filterType],
    queryFn: async () => {
      let q = supabase
        .from("app_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filterType !== "all") q = q.eq("error_type", filterType);
      const { data } = await q;
      return data ?? [];
    },
  });

  const count24h = errors?.filter(e =>
    new Date(e.created_at).getTime() > Date.now() - 86400000
  ).length ?? 0;

  const count7d = errors?.filter(e =>
    new Date(e.created_at).getTime() > Date.now() - 7 * 86400000
  ).length ?? 0;

  const handleCleanup = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    await supabase.from("app_error_logs").delete().lt("created_at", thirtyDaysAgo);
    refetch();
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Error Log</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">24h: {count24h}</Badge>
          <Badge variant="outline" className="text-[10px]">7d: {count7d}</Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ERROR_TYPES.map(t => (
              <SelectItem key={t} value={t} className="text-xs">
                {t === "all" ? "Tutti i tipi" : t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCleanup}>
          <Trash2 className="w-3 h-3" /> Pulisci &gt;30gg
        </Button>
      </div>

      {!errors?.length ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nessun errore registrato</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {errors.map((err) => (
            <div key={err.id} className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 p-2 text-xs">
              <Badge className={`shrink-0 text-[9px] ${typeColors[err.error_type] ?? "bg-muted text-muted-foreground"}`}>
                {err.error_type}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{err.error_message || "—"}</p>
                <p className="text-muted-foreground mt-0.5">
                  {err.page_url} · {formatDistanceToNow(new Date(err.created_at), { addSuffix: true, locale: it })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
