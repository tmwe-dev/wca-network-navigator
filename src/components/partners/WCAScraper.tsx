import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Download, CheckCircle, AlertCircle, Loader2, Square } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { scrapeWcaPartnerById, type ScrapeSingleResult } from "@/lib/api/wcaScraper";
import { useQueryClient } from "@tanstack/react-query";

interface ScrapeLog {
  wcaId: number;
  status: "success" | "not_found" | "error";
  action?: string;
  companyName?: string;
  error?: string;
}

export function WCAScraper() {
  const [startId, setStartId] = useState(11470);
  const [endId, setEndId] = useState(11470);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [stats, setStats] = useState({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
  const abortRef = useRef(false);
  const queryClient = useQueryClient();

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

  const handleScrape = async () => {
    if (startId > endId) {
      toast({ title: "Errore", description: "L'ID iniziale deve essere ≤ ID finale", variant: "destructive" });
      return;
    }

    abortRef.current = false;
    setIsLoading(true);
    setLogs([]);
    setStats({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
    setProgress(0);

    const total = endId - startId + 1;
    let processed = 0;
    let localStats = { found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 };

    for (let id = startId; id <= endId; id++) {
      if (abortRef.current) break;

      setCurrentId(id);
      setProgress(Math.round((processed / total) * 100));

      try {
        const result = await scrapeWcaPartnerById(id);

        const log: ScrapeLog = { wcaId: id, status: "error" };

        if (result.success && result.found) {
          log.status = "success";
          log.action = result.action;
          log.companyName = result.partner?.company_name;
          localStats.found++;
          if (result.action === "inserted") localStats.inserted++;
          if (result.action === "updated") localStats.updated++;
        } else if (result.success && !result.found) {
          log.status = "not_found";
          localStats.notFound++;
        } else {
          log.status = "error";
          log.error = result.error;
          localStats.errors++;
        }

        setLogs((prev) => [log, ...prev]);
        setStats({ ...localStats });
      } catch (err) {
        const log: ScrapeLog = { wcaId: id, status: "error", error: String(err) };
        setLogs((prev) => [log, ...prev]);
        localStats.errors++;
        setStats({ ...localStats });
      }

      processed++;

      if (id < endId && !abortRef.current) {
        // Every 10 partners: 30s pause, otherwise 5s
        if (processed % 10 === 0) {
          await sleep(30000);
        } else {
          await sleep(5000);
        }
      }
    }

    setProgress(100);
    setCurrentId(null);
    setCountdown(0);
    setIsLoading(false);
    queryClient.invalidateQueries({ queryKey: ["partners"] });

    toast({
      title: abortRef.current ? "Scraping interrotto" : "Scraping completato",
      description: `Trovati: ${localStats.found}, Nuovi: ${localStats.inserted}, Aggiornati: ${localStats.updated}, Non trovati: ${localStats.notFound}, Errori: ${localStats.errors}`,
    });
  };

  const total = Math.max(0, endId - startId + 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Scarica Partner da WCA
          </CardTitle>
          <CardDescription>
            Scarica i profili partner da wcaworld.com per ID membro. Velocità umana per evitare blocchi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">ID Iniziale</label>
              <Input
                type="number"
                value={startId}
                onChange={(e) => setStartId(Number(e.target.value))}
                min={1}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ID Finale</label>
              <Input
                type="number"
                value={endId}
                onChange={(e) => setEndId(Number(e.target.value))}
                min={1}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleScrape} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scraping in corso...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Scarica ({total} {total === 1 ? "profilo" : "profili"})
                </>
              )}
            </Button>
            {isLoading && (
              <Button variant="destructive" onClick={handleStop}>
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            )}
          </div>

          {isLoading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {currentId && `ID: ${currentId}`}
                {countdown > 0 && ` — Prossimo tra ${countdown}s`}
                {" — "}{progress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Risultati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{stats.found}</p>
                <p className="text-xs text-muted-foreground">Trovati</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-green-600">{stats.inserted}</p>
                <p className="text-xs text-muted-foreground">Nuovi</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-blue-600">{stats.updated}</p>
                <p className="text-xs text-muted-foreground">Aggiornati</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-yellow-600">{stats.notFound}</p>
                <p className="text-xs text-muted-foreground">Non trovati</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
                <p className="text-xs text-muted-foreground">Errori</p>
              </div>
            </div>

            <div className="space-y-1 max-h-60 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="font-mono text-xs">ID {log.wcaId}</span>
                  <div className="flex items-center gap-2">
                    {log.status === "success" && (
                      <>
                        <span className="text-xs truncate max-w-[200px]">{log.companyName}</span>
                        <Badge className={log.action === "inserted" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                          {log.action === "inserted" ? "Nuovo" : "Aggiornato"}
                        </Badge>
                      </>
                    )}
                    {log.status === "not_found" && (
                      <Badge variant="secondary">Non trovato</Badge>
                    )}
                    {log.status === "error" && (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Errore
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
