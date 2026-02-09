import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Square, Pause, Building2, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import { useDownloadQueue, type DownloadQueueItem } from "@/hooks/useDownloadQueue";
import { scrapeWcaPartnerById, type ScrapeSingleResult, type AIClassification } from "@/lib/api/wcaScraper";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface ScrapeLog {
  wcaId: number;
  status: "success" | "not_found" | "error";
  action?: string;
  companyName?: string;
  city?: string;
  countryCode?: string;
  aiSummary?: string;
  error?: string;
}

export function DownloadRunner() {
  const { data: queue, updateItem } = useDownloadQueue();
  const queryClient = useQueryClient();

  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [stats, setStats] = useState({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const abortRef = useRef(false);

  const pendingItems = queue?.filter(q => q.status === "pending" || q.status === "paused" || q.status === "in_progress") || [];
  const selectedItem = queue?.find(q => q.id === selectedQueueId);

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
    if (!selectedItem) return;

    abortRef.current = false;
    setIsRunning(true);
    setLogs([]);
    setStats({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });

    const startId = selectedItem.last_processed_id
      ? selectedItem.last_processed_id + 1
      : selectedItem.id_range_start || 1;
    const endId = selectedItem.id_range_end || 99999;

    updateItem.mutate({ id: selectedItem.id, status: "in_progress" });

    let localStats = { found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 };
    let processed = selectedItem.total_processed;
    let consecutiveNotFound = 0;

    for (let id = startId; id <= endId; id++) {
      if (abortRef.current) break;

      setCurrentId(id);

      try {
        const result = await scrapeWcaPartnerById(id);
        const log: ScrapeLog = { wcaId: id, status: "error" };

        if (result.success && result.found) {
          const partner = result.partner;
          // Filter by country if this queue item has a specific country
          if (partner && partner.country_code?.trim().toUpperCase() !== selectedItem.country_code.trim().toUpperCase()) {
            // Different country, skip but log
            consecutiveNotFound++;
            if (consecutiveNotFound > 100) break; // stop if too many misses
            continue;
          }

          consecutiveNotFound = 0;
          log.status = "success";
          log.action = result.action;
          log.companyName = partner?.company_name;
          log.city = partner?.city;
          log.countryCode = partner?.country_code;
          log.aiSummary = result.aiClassification?.summary;
          localStats.found++;
          if (result.action === "inserted") localStats.inserted++;
          if (result.action === "updated") localStats.updated++;
        } else if (result.success && !result.found) {
          log.status = "not_found";
          localStats.notFound++;
          consecutiveNotFound++;
          if (consecutiveNotFound > 200) break;
        } else {
          log.status = "error";
          log.error = result.error;
          localStats.errors++;
        }

        setLogs(prev => [log, ...prev].slice(0, 200));
        setStats({ ...localStats });
        processed++;

        // Update queue progress every 5 partners
        if (processed % 5 === 0) {
          updateItem.mutate({
            id: selectedItem.id,
            total_processed: processed,
            total_found: localStats.found,
            last_processed_id: id,
          });
        }
      } catch (err) {
        const errLog: ScrapeLog = { wcaId: id, status: "error", error: String(err) };
        setLogs(prev => [errLog, ...prev].slice(0, 200));
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

    // Final update
    updateItem.mutate({
      id: selectedItem.id,
      total_processed: processed,
      total_found: localStats.found,
      last_processed_id: currentId || startId,
      status: abortRef.current ? "paused" : "completed",
    });

    setIsRunning(false);
    setCurrentId(null);
    setCountdown(0);
    queryClient.invalidateQueries({ queryKey: ["partners"] });

    toast({
      title: abortRef.current ? "Download in pausa" : "Download completato",
      description: `Trovati: ${localStats.found}, Nuovi: ${localStats.inserted}, Aggiornati: ${localStats.updated}`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5" />
            Download Sequenziale
          </CardTitle>
          <CardDescription>
            Seleziona un paese dalla coda e avvia il download uno per uno con classificazione AI automatica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona paese dalla coda..." />
            </SelectTrigger>
            <SelectContent>
              {pendingItems.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  {item.country_code} — {item.country_name} ({item.network_name})
                  {item.last_processed_id && ` • riprende da #${item.last_processed_id}`}
                </SelectItem>
              ))}
              {pendingItems.length === 0 && (
                <SelectItem value="none" disabled>Nessun paese in coda</SelectItem>
              )}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              onClick={handleStart}
              disabled={isRunning || !selectedQueueId}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scaricando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {selectedItem?.last_processed_id ? "Riprendi Download" : "Avvia Download"}
                </>
              )}
            </Button>
            {isRunning && (
              <Button variant="destructive" onClick={handleStop}>
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
          </div>

          {isRunning && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                ID: #{currentId} — Trovati: {stats.found} — Nuovi: {stats.inserted}
                {countdown > 0 && ` — Prossimo tra ${countdown}s`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Risultati ({stats.found} trovati)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <StatBox label="Trovati" value={stats.found} />
              <StatBox label="Nuovi" value={stats.inserted} className="text-green-600" />
              <StatBox label="Aggiornati" value={stats.updated} className="text-blue-600" />
              <StatBox label="Non trovati" value={stats.notFound} className="text-yellow-600" />
              <StatBox label="Errori" value={stats.errors} className="text-red-600" />
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto border rounded-lg">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 px-3 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">#{log.wcaId}</span>
                    {log.status === "success" && (
                      <div className="flex flex-col min-w-0 gap-0.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-medium truncate">{log.companyName}</span>
                          <span className="text-muted-foreground text-xs hidden sm:inline">
                            <MapPin className="w-3 h-3 inline mr-0.5" />
                            {log.city}, {log.countryCode}
                          </span>
                        </div>
                        {log.aiSummary && (
                          <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                            {log.aiSummary}
                          </p>
                        )}
                      </div>
                    )}
                    {log.status === "not_found" && <span className="text-muted-foreground">Non trovato</span>}
                    {log.status === "error" && (
                      <span className="text-destructive text-xs truncate">{log.error || "Errore"}</span>
                    )}
                  </div>
                  <div className="shrink-0 ml-2">
                    {log.status === "success" && (
                      <Badge variant={log.action === "inserted" ? "default" : "secondary"} className="text-xs">
                        {log.action === "inserted" ? "Nuovo" : "Aggiornato"}
                      </Badge>
                    )}
                    {log.status === "not_found" && <Badge variant="outline" className="text-xs">Skip</Badge>}
                    {log.status === "error" && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />Errore
                      </Badge>
                    )}
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

function StatBox({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted">
      <p className={`text-2xl font-bold ${className || ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
