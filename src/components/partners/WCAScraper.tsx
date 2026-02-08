import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { scrapeWcaPartners, type ScrapeResponse } from "@/lib/api/wcaScraper";
import { useQueryClient } from "@tanstack/react-query";

type RegionFilter = "all" | "europe" | "asia" | "americas" | "africa" | "oceania" | "middle_east";

const REGION_LABELS: Record<RegionFilter, string> = {
  all: "Tutti i paesi",
  europe: "Europa",
  asia: "Asia",
  americas: "Americhe",
  africa: "Africa",
  oceania: "Oceania",
  middle_east: "Medio Oriente",
};

export function WCAScraper() {
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCountry, setCurrentCountry] = useState("");
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const queryClient = useQueryClient();

  const filteredCountries =
    selectedRegion === "all"
      ? WCA_COUNTRIES
      : WCA_COUNTRIES.filter((c) => c.region === selectedRegion);

  const getCountriesToScrape = () => {
    if (selectedCountry !== "all") {
      const country = WCA_COUNTRIES.find((c) => c.code === selectedCountry);
      return country ? [country] : [];
    }
    return filteredCountries;
  };

  const handleScrape = async () => {
    const countries = getCountriesToScrape();
    if (countries.length === 0) return;

    setIsLoading(true);
    setResult(null);
    setProgress(0);

    // Process in batches of 5 countries per request to avoid timeouts
    const batchSize = 5;
    const allResults: ScrapeResponse["results"] = [];
    let totalSummary = { totalCountries: 0, totalFound: 0, totalInserted: 0, totalUpdated: 0, totalErrors: 0 };

    for (let i = 0; i < countries.length; i += batchSize) {
      const batch = countries.slice(i, i + batchSize);
      const codes = batch.map((c) => c.code);
      const names = batch.map((c) => c.name);

      setCurrentCountry(batch.map((c) => c.name).join(", "));
      setProgress(Math.round((i / countries.length) * 100));

      try {
        const response = await scrapeWcaPartners(codes, names);

        if (response.success && response.results) {
          allResults.push(...response.results);
          if (response.summary) {
            totalSummary.totalCountries += response.summary.totalCountries;
            totalSummary.totalFound += response.summary.totalFound;
            totalSummary.totalInserted += response.summary.totalInserted;
            totalSummary.totalUpdated += response.summary.totalUpdated;
            totalSummary.totalErrors += response.summary.totalErrors;
          }
        } else {
          toast({
            title: "Errore scraping",
            description: response.error || `Errore nel batch ${codes.join(", ")}`,
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Scrape batch error:", err);
        toast({
          title: "Errore",
          description: `Errore di rete per ${codes.join(", ")}`,
          variant: "destructive",
        });
      }
    }

    setProgress(100);
    setCurrentCountry("");
    setIsLoading(false);

    const finalResult: ScrapeResponse = {
      success: true,
      summary: totalSummary,
      results: allResults,
    };
    setResult(finalResult);

    queryClient.invalidateQueries({ queryKey: ["partners"] });

    toast({
      title: "Scraping completato",
      description: `Trovati ${totalSummary.totalFound} partner, ${totalSummary.totalInserted} nuovi, ${totalSummary.totalUpdated} aggiornati`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Scarica Partner da WCA
          </CardTitle>
          <CardDescription>
            Scarica automaticamente i partner dalla directory pubblica di wcaworld.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Regione</label>
              <Select
                value={selectedRegion}
                onValueChange={(v) => {
                  setSelectedRegion(v as RegionFilter);
                  setSelectedCountry("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REGION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Paese</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Tutti ({filteredCountries.length} paesi)
                  </SelectItem>
                  {filteredCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleScrape}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scraping in corso...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Scarica da WCA ({getCountriesToScrape().length} {getCountriesToScrape().length === 1 ? "paese" : "paesi"})
              </>
            )}
          </Button>

          {isLoading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {currentCountry && `Scaricando: ${currentCountry}`}
                {" — "}{progress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {result?.success && result.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Risultati Scraping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{result.summary.totalFound}</p>
                <p className="text-xs text-muted-foreground">Trovati</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-green-600">{result.summary.totalInserted}</p>
                <p className="text-xs text-muted-foreground">Nuovi</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-blue-600">{result.summary.totalUpdated}</p>
                <p className="text-xs text-muted-foreground">Aggiornati</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-red-600">{result.summary.totalErrors}</p>
                <p className="text-xs text-muted-foreground">Errori</p>
              </div>
            </div>

            {result.results && result.results.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <span className="font-medium">{r.country}</span>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{r.found} trovati</Badge>
                      {r.inserted > 0 && <Badge className="bg-green-100 text-green-800">{r.inserted} nuovi</Badge>}
                      {r.updated > 0 && <Badge className="bg-blue-100 text-blue-800">{r.updated} agg.</Badge>}
                      {r.errors > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {r.errors}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
