import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ArrowUp, ArrowDown, Plus, ListOrdered, Loader2 } from "lucide-react";
import { useDownloadQueue } from "@/hooks/useDownloadQueue";
import { useNetworkConfigs } from "@/hooks/useNetworkConfigs";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function DownloadQueue() {
  const { data: queue, isLoading, addToQueue, updateItem, removeItem, clearCompleted } = useDownloadQueue();
  const { data: configs } = useNetworkConfigs();
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [countrySearch, setCountrySearch] = useState("");

  // Get existing partner counts per country
  const { data: countryCounts } = useQuery({
    queryKey: ["partner-country-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("country_code");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((p) => {
        counts[p.country_code] = (counts[p.country_code] || 0) + 1;
      });
      return counts;
    },
  });

  const memberNetworks = configs?.filter(c => c.is_member) || [];

  const filteredCountries = WCA_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const toggleCountry = (code: string) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleAddToQueue = () => {
    if (!selectedNetwork || selectedCountries.length === 0) return;

    const existingCodes = new Set(queue?.map(q => `${q.country_code}-${q.network_name}`) || []);
    const maxPriority = Math.max(0, ...(queue?.map(q => q.priority) || [0]));

    const newItems = selectedCountries
      .filter(code => !existingCodes.has(`${code}-${selectedNetwork}`))
      .map((code, i) => {
        const country = WCA_COUNTRIES.find(c => c.code === code);
        return {
          country_code: code,
          country_name: country?.name || code,
          network_name: selectedNetwork,
          priority: maxPriority + i + 1,
          id_range_start: null as number | null,
          id_range_end: null as number | null,
          status: "pending" as const,
        };
      });

    if (newItems.length > 0) {
      addToQueue.mutate(newItems);
      setSelectedCountries([]);
    }
  };

  const handleMovePriority = (item: typeof queue extends (infer T)[] | undefined ? T : never, direction: "up" | "down") => {
    if (!queue) return;
    const sorted = [...queue].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(q => q.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    updateItem.mutate({ id: item.id, priority: sorted[swapIdx].priority });
    updateItem.mutate({ id: sorted[swapIdx].id, priority: item.priority });
  };

  const statusColors: Record<string, string> = {
    pending: "secondary",
    in_progress: "default",
    completed: "outline",
    paused: "destructive",
  };

  const statusLabels: Record<string, string> = {
    pending: "In attesa",
    in_progress: "In corso",
    completed: "Completato",
    paused: "In pausa",
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Add countries to queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Aggiungi Paesi alla Coda
          </CardTitle>
          <CardDescription>
            Seleziona il network e i paesi da scaricare. Puoi riordinare le priorità dopo averli aggiunti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona network..." />
            </SelectTrigger>
            <SelectContent>
              {memberNetworks.map(n => (
                <SelectItem key={n.id} value={n.network_name}>{n.network_name}</SelectItem>
              ))}
              {memberNetworks.length === 0 && (
                <SelectItem value="none" disabled>Nessun network configurato come membro</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Input
            placeholder="Cerca paese..."
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-60 overflow-y-auto border rounded-lg p-2">
            {filteredCountries.map(country => {
              const isSelected = selectedCountries.includes(country.code);
              const count = countryCounts?.[country.code] || 0;
              return (
                <button
                  key={country.code}
                  onClick={() => toggleCountry(country.code)}
                  className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="truncate">{country.code} {country.name}</span>
                  {count > 0 && <span className="text-[10px] opacity-70 ml-1">({count})</span>}
                </button>
              );
            })}
          </div>

          {selectedCountries.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{selectedCountries.length} paesi selezionati</span>
              <Button onClick={handleAddToQueue} disabled={!selectedNetwork}>
                <Plus className="w-4 h-4 mr-1" />
                Aggiungi alla coda
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue */}
      {queue && queue.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListOrdered className="w-5 h-5" />
                Coda Download ({queue.length} paesi)
              </CardTitle>
              {queue.some(q => q.status === "completed") && (
                <Button variant="ghost" size="sm" onClick={() => clearCompleted.mutate()}>
                  Rimuovi completati
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...queue].sort((a, b) => a.priority - b.priority).map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-6">#{idx + 1}</span>
                    <div>
                      <p className="font-medium text-sm">
                        {item.country_code} — {item.country_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.network_name}
                        {item.total_processed > 0 && ` • ${item.total_processed} processati`}
                        {item.total_found > 0 && ` • ${item.total_found} trovati`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={statusColors[item.status] as any}>
                      {statusLabels[item.status]}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMovePriority(item, "up")}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMovePriority(item, "down")}
                        disabled={idx === queue.length - 1}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem.mutate(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
