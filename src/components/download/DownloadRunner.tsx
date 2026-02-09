import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Play, Square, Building2, MapPin, CheckCircle, AlertCircle, Search, Timer, TrendingUp
} from "lucide-react";
import { scrapeWcaPartnerById, type ScrapeSingleResult } from "@/lib/api/wcaScraper";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { WCA_NETWORKS, WCA_REGIONS, WCA_SERVICES } from "@/data/wcaFilters";

interface ScrapeLog {
  wcaId: number;
  status: "success" | "not_found" | "error";
  action?: string;
  companyName?: string;
  city?: string;
  countryCode?: string;
  network?: string;
  services?: string[];
  aiSummary?: string;
  error?: string;
  partner?: any;
}

type ScrapingMode = "manual" | "auto";

export function DownloadRunner() {
  const queryClient = useQueryClient();

  // Scraping mode
  const [mode, setMode] = useState<ScrapingMode>("manual");
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [stats, setStats] = useState({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const abortRef = useRef(false);

  // Saved last processed ID (persisted in localStorage)
  const [savedLastId, setSavedLastId] = useState<number>(() => {
    const saved = localStorage.getItem("wca_scraper_last_id");
    return saved ? parseInt(saved, 10) : 0;
  });

  // Cataloging filters
  const [filterNetwork, setFilterNetwork] = useState<string>("__all__");
  const [filterRegion, setFilterRegion] = useState<string>("__all__");
  const [filterServices, setFilterServices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Detail modal
  const [detailPartner, setDetailPartner] = useState<any | null>(null);

  // Speed calc
  const elapsed = startTime ? (Date.now() - startTime) / 1000 / 60 : 0;
  const speed = elapsed > 0 ? (stats.found / elapsed).toFixed(1) : "0";

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            resolve();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setCountdown(Math.ceil(ms / 1000));
    });

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleStart = async () => {
    abortRef.current = false;
    setIsRunning(true);
    setLogs([]);
    setStats({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
    setStartTime(Date.now());

    let startId: number;
    let endId: number;

    if (mode === "manual") {
      startId = parseInt(rangeStart, 10) || 1;
      endId = parseInt(rangeEnd, 10) || startId + 100;
    } else {
      // Auto mode: resume from last saved ID
      startId = savedLastId > 0 ? savedLastId + 1 : 1;
      endId = 999999; // effectively infinite
    }

    let localStats = { found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 };
    let processed = 0;
    let consecutiveNotFound = 0;

    for (let id = startId; id <= endId; id++) {
      if (abortRef.current) break;

      setCurrentId(id);

      try {
        const result = await scrapeWcaPartnerById(id);
        const log: ScrapeLog = { wcaId: id, status: "error" };

        if (result.success && result.found) {
          consecutiveNotFound = 0;
          const partner = result.partner;
          log.status = "success";
          log.action = result.action;
          log.companyName = partner?.company_name;
          log.city = partner?.city;
          log.countryCode = partner?.country_code;
          log.aiSummary = result.aiClassification?.summary;
          log.partner = partner;
          localStats.found++;
          if (result.action === "inserted") localStats.inserted++;
          if (result.action === "updated") localStats.updated++;
        } else if (result.success && !result.found) {
          log.status = "not_found";
          localStats.notFound++;
          consecutiveNotFound++;
          // In auto mode, don't stop on not-found streaks as easily
          if (mode === "manual" && consecutiveNotFound > 200) break;
          if (mode === "auto" && consecutiveNotFound > 500) break;
        } else {
          log.status = "error";
          log.error = result.error;
          localStats.errors++;
        }

        setLogs(prev => [log, ...prev].slice(0, 500));
        setStats({ ...localStats });

        // Save last processed ID
        setSavedLastId(id);
        localStorage.setItem("wca_scraper_last_id", String(id));
      } catch (err) {
        const errLog: ScrapeLog = { wcaId: id, status: "error", error: String(err) };
        setLogs(prev => [errLog, ...prev].slice(0, 500));
        localStats.errors++;
        setStats({ ...localStats });
      }

      processed++;

      if (!abortRef.current) {
        if (processed % 10 === 0) {
          await sleep(30000);
        } else {
          await sleep(5000);
        }
      }
    }

    setIsRunning(false);
    setCurrentId(null);
    setCountdown(0);
    queryClient.invalidateQueries({ queryKey: ["partners"] });

    toast({
      title: abortRef.current ? "Download in pausa" : "Download completato",
      description: `Trovati: ${localStats.found}, Nuovi: ${localStats.inserted}, Aggiornati: ${localStats.updated}`,
    });
  };

  // Filter logs for display
  const filteredLogs = logs.filter(log => {
    if (log.status !== "success") return true; // always show errors/not-found
    if (searchQuery && !log.companyName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Note: network/region/services filters are for cataloging display, not scraping
    return true;
  });

  const successLogs = logs.filter(l => l.status === "success");

  return (
    <div className="space-y-6">
      {/* Scraping Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5" />
            Scarica da WCA
          </CardTitle>
          <CardDescription>
            Scarica profili dalla directory WCA uno per uno. URL: wcaworld.com/directory/members/&#123;ID&#125;
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode selection */}
          <div className="flex gap-2">
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("manual")}
              disabled={isRunning}
            >
              Manuale
            </Button>
            <Button
              variant={mode === "auto" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("auto")}
              disabled={isRunning}
            >
              Automatico
            </Button>
          </div>

          {mode === "manual" ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">ID Inizio</label>
                <Input
                  type="number"
                  placeholder="es. 11470"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">ID Fine</label>
                <Input
                  type="number"
                  placeholder="es. 11500"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  disabled={isRunning}
                />
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted text-sm">
              <p>
                Modalità automatica: parte da ID <strong>{savedLastId > 0 ? savedLastId + 1 : 1}</strong> e
                procede fino a quando non lo fermi.
              </p>
              {savedLastId > 0 && (
                <p className="text-muted-foreground mt-1">
                  Ultimo ID processato: <strong>#{savedLastId}</strong>
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 h-auto p-0 text-xs"
                    onClick={() => { setSavedLastId(0); localStorage.removeItem("wca_scraper_last_id"); }}
                  >
                    Reset
                  </Button>
                </p>
              )}
            </div>
          )}

          {/* Start/Stop */}
          <div className="flex gap-2">
            <Button
              onClick={handleStart}
              disabled={isRunning || (mode === "manual" && !rangeStart)}
              className="flex-1"
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scaricando...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />{mode === "auto" && savedLastId > 0 ? "Riprendi" : "Avvia Download"}</>
              )}
            </Button>
            {isRunning && (
              <Button variant="destructive" onClick={handleStop}>
                <Square className="w-4 h-4 mr-1" />
                Pausa
              </Button>
            )}
          </div>

          {/* Live status */}
          {isRunning && (
            <p className="text-sm text-muted-foreground text-center">
              ID: #{currentId}
              {countdown > 0 && ` — Prossimo tra ${countdown}s`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Live Stats */}
      {(isRunning || logs.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Statistiche Live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <StatBox label="Trovati" value={stats.found} />
              <StatBox label="Nuovi" value={stats.inserted} className="text-green-600" />
              <StatBox label="Aggiornati" value={stats.updated} className="text-blue-600" />
              <StatBox label="Non trovati" value={stats.notFound} className="text-yellow-600" />
              <StatBox label="Errori" value={stats.errors} className="text-destructive" />
              <StatBox label="Partner/min" value={speed} icon={<Timer className="w-3.5 h-3.5 text-muted-foreground" />} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cataloging Filters + Partner List */}
      {successLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Partner Trovati ({successLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters for cataloging */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={filterNetwork} onValueChange={setFilterNetwork}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutti i Network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti i Network</SelectItem>
                  {WCA_NETWORKS.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterRegion} onValueChange={setFilterRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutte le Regioni" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutte le Regioni</SelectItem>
                  {WCA_REGIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca partner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Services multi-select */}
            <div className="flex flex-wrap gap-2">
              {WCA_SERVICES.map(service => (
                <label
                  key={service}
                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Checkbox
                    checked={filterServices.has(service)}
                    onCheckedChange={(checked) => {
                      setFilterServices(prev => {
                        const next = new Set(prev);
                        checked ? next.add(service) : next.delete(service);
                        return next;
                      });
                    }}
                  />
                  {service}
                </label>
              ))}
            </div>

            {/* Partner table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Nome Azienda</th>
                      <th className="px-3 py-2 font-medium">Paese</th>
                      <th className="px-3 py-2 font-medium">Città</th>
                      <th className="px-3 py-2 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLogs
                      .filter(l => l.status === "success")
                      .filter(l => !searchQuery || l.companyName?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((log, i) => (
                        <tr
                          key={`${log.wcaId}-${i}`}
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setDetailPartner(log)}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">#{log.wcaId}</td>
                          <td className="px-3 py-2 font-medium">{log.companyName}</td>
                          <td className="px-3 py-2">{log.countryCode}</td>
                          <td className="px-3 py-2 text-muted-foreground">{log.city}</td>
                          <td className="px-3 py-2">
                            <Badge variant={log.action === "inserted" ? "default" : "secondary"} className="text-xs">
                              {log.action === "inserted" ? "Nuovo" : "Aggiornato"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {filteredLogs.filter(l => l.status === "success").length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-6">Nessun partner trovato</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error/not-found logs */}
      {logs.filter(l => l.status !== "success").length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Log errori / non trovati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
              {logs.filter(l => l.status !== "success").slice(0, 50).map((log, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="font-mono text-muted-foreground">#{log.wcaId}</span>
                  {log.status === "not_found" && <span className="text-muted-foreground">Non trovato</span>}
                  {log.status === "error" && <span className="text-destructive">{log.error || "Errore"}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailPartner} onOpenChange={() => setDetailPartner(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {detailPartner?.companyName}
            </DialogTitle>
          </DialogHeader>
          {detailPartner && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">WCA ID:</span> #{detailPartner.wcaId}</div>
                <div><span className="text-muted-foreground">Paese:</span> {detailPartner.countryCode}</div>
                <div><span className="text-muted-foreground">Città:</span> {detailPartner.city}</div>
                <div>
                  <span className="text-muted-foreground">Stato:</span>{" "}
                  <Badge variant={detailPartner.action === "inserted" ? "default" : "secondary"} className="text-xs">
                    {detailPartner.action === "inserted" ? "Nuovo" : "Aggiornato"}
                  </Badge>
                </div>
              </div>
              {detailPartner.aiSummary && (
                <div>
                  <p className="text-muted-foreground mb-1">Riassunto AI:</p>
                  <p className="bg-muted rounded-lg p-3 text-sm">{detailPartner.aiSummary}</p>
                </div>
              )}
              {detailPartner.partner && (
                <div>
                  <p className="text-muted-foreground mb-1">Dati completi:</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto max-h-60">
                    {JSON.stringify(detailPartner.partner, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ label, value, className, icon }: { label: string; value: number | string; className?: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <p className={`text-2xl font-bold ${className || ""}`}>{value}</p>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
