import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listFunnemailScoutCache, invalidateFunnemailScoutCache, type FunnemailScoutCacheRow } from "@/data/funnemailScoutCache";

const QK = ["funnemail", "scout-cache"] as const;

export default function ScoutCacheTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: QK, queryFn: () => listFunnemailScoutCache(200) });

  return (
    <div className="flex flex-col gap-2 overflow-auto pb-6">
      {isLoading && <p className="text-sm text-muted-foreground">Carico...</p>}
      {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">Cache scout vuota.</p>}
      {rows.map((r: FunnemailScoutCacheRow) => {
        const expired = new Date(r.expires_at).getTime() < Date.now();
        return (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.email_address ?? r.email_domain}</span>
                  {r.is_known_partner && <Badge variant="secondary">known</Badge>}
                  {r.company_type && <Badge variant="outline">{r.company_type}</Badge>}
                  {r.role_guess && <Badge variant="outline">{r.role_guess}</Badge>}
                  {expired && <Badge variant="destructive">expired</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  source: {r.scout_source ?? "?"} · cached {new Date(r.cached_at).toLocaleString()} · expires {new Date(r.expires_at).toLocaleDateString()}
                </span>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={async () => {
                  await invalidateFunnemailScoutCache(r.id);
                  toast.success("Cache invalidata");
                  qc.invalidateQueries({ queryKey: QK });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
