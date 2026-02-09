import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Globe, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { WCA_COUNTRIES } from "@/data/wcaCountries";

interface PartnerRow {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  rating: number | null;
  website: string | null;
  enriched_at: string | null;
  partner_type: string | null;
}

export function BatchEnrichment() {
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [onlyNotEnriched, setOnlyNotEnriched] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [search, setSearch] = useState("");

  const { data: partners, isLoading, refetch } = useQuery({
    queryKey: ["enrichment-partners", filterCountry, filterType, onlyNotEnriched],
    queryFn: async () => {
      let query = supabase
        .from("partners")
        .select("id, company_name, city, country_code, country_name, rating, website, enriched_at, partner_type")
        .not("website", "is", null)
        .order("company_name");

      if (filterCountry) query = query.eq("country_code", filterCountry);
      if (filterType) query = query.eq("partner_type", filterType as any);
      if (onlyNotEnriched) query = query.is("enriched_at", null);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as PartnerRow[];
    },
  });

  const filteredPartners = partners?.filter(p =>
    !search || p.company_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filteredPartners.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredPartners.map(p => p.id)));
    }
  };

  const handleEnrich = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    setIsEnriching(true);
    setProgress({ current: 0, total: ids.length });

    let success = 0;
    let errors = 0;

    for (let i = 0; i < ids.length; i++) {
      const partner = partners?.find(p => p.id === ids[i]);
      if (!partner?.website) continue;

      setProgress({ current: i + 1, total: ids.length });

      try {
        const { error } = await supabase.functions.invoke("enrich-partner-website", {
          body: { partnerId: partner.id, website: partner.website },
        });
        if (error) throw error;
        success++;
      } catch {
        errors++;
      }

      // Delay between requests
      if (i < ids.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setIsEnriching(false);
    setSelected(new Set());
    refetch();

    toast({
      title: "Arricchimento completato",
      description: `Successo: ${success}, Errori: ${errors}`,
    });
  };

  const uniqueCountries = [...new Set(partners?.map(p => p.country_code) || [])].sort();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Arricchimento dal Sito Web
          </CardTitle>
          <CardDescription>
            Seleziona un gruppo di partner e arricchisci i loro dati leggendo il sito web con AI. Solo partner con sito web.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Tutti i paesi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tutti i paesi</SelectItem>
                {WCA_COUNTRIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Tutti i tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tutti i tipi</SelectItem>
                <SelectItem value="freight_forwarder">Freight Forwarder</SelectItem>
                <SelectItem value="customs_broker">Customs Broker</SelectItem>
                <SelectItem value="carrier">Carrier</SelectItem>
                <SelectItem value="nvocc">NVOCC</SelectItem>
                <SelectItem value="3pl">3PL</SelectItem>
                <SelectItem value="courier">Courier</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={onlyNotEnriched}
                onCheckedChange={(v) => setOnlyNotEnriched(!!v)}
              />
              <span className="text-sm">Solo non arricchiti</span>
            </div>
          </div>

          <Input
            placeholder="Cerca per nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Partner list */}
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selected.size === filteredPartners.length ? "Deseleziona tutti" : `Seleziona tutti (${filteredPartners.length})`}
                </Button>
                {selected.size > 0 && (
                  <Button onClick={handleEnrich} disabled={isEnriching}>
                    {isEnriching ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Arricchisci ({selected.size})
                  </Button>
                )}
              </div>

              {isEnriching && (
                <div className="space-y-2">
                  <Progress value={(progress.current / progress.total) * 100} />
                  <p className="text-sm text-muted-foreground text-center">
                    {progress.current} di {progress.total}
                  </p>
                </div>
              )}

              <div className="space-y-1 max-h-96 overflow-y-auto border rounded-lg">
                {filteredPartners.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleSelect(p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selected.has(p.id)} />
                      <div>
                        <p className="text-sm font-medium">{p.company_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.city}, {p.country_code}
                          {p.rating && ` • ★${p.rating}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.enriched_at && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {p.website && (
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
                {filteredPartners.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    Nessun partner trovato con i filtri selezionati
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
