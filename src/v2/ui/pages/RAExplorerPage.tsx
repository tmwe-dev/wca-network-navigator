/**
 * RAExplorerPage — Explore RA prospects with filters
 */
import * as React from "react";
import { useState } from "react";
import { useProspectsV2 } from "@/v2/hooks/useProspectsV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Search, MapPin } from "lucide-react";

export function RAExplorerPage(): React.ReactElement {
  const [regionFilter, setRegionFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const { data: prospects } = useProspectsV2(regionFilter);

  const filtered = (prospects ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.companyName.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5" /> RA Explorer
          </h1>
          <p className="text-xs text-muted-foreground">{filtered.length} prospect</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca azienda..." className="pl-8" />
        </div>
        <Input value={regionFilter ?? ""} onChange={(e) => setRegionFilter(e.target.value || undefined)} placeholder="Regione..." className="w-40" />
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {filtered.slice(0, 200).map((p) => (
            <Card key={p.id} className="cursor-pointer hover:border-primary/30 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.companyName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.city ?? "N/A"}, {p.province ?? ""} • {p.codiceAteco ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.fatturato && <Badge variant="outline">€{(p.fatturato / 1000).toFixed(0)}k</Badge>}
                    <Badge>{p.leadStatus}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
