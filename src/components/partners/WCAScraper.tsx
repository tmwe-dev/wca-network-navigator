import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Download, CheckCircle, AlertCircle, Loader2, Square, Building2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { scrapeWcaPartnerById, type ScrapeSingleResult, type AIClassification } from "@/lib/api/wcaScraper";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PartnerDetailModal } from "./PartnerDetailModal";

interface ScrapeLog {
  wcaId: number;
  status: "success" | "not_found" | "error";
  action?: string;
  companyName?: string;
  city?: string;
  countryCode?: string;
  countryName?: string;
  partner?: ScrapeSingleResult["partner"];
  partnerId?: string;
  aiClassification?: AIClassification;
  hasContactDetails?: boolean;
  error?: string;
}

export function WCAScraper() {
  const [startId, setStartId] = useState(11470);
  const [endId, setEndId] = useState(11470);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [stats, setStats] = useState({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
  const [selectedLog, setSelectedLog] = useState<ScrapeLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const abortRef = useRef(false);
  const queryClient = useQueryClient();

  // Get max wca_id for sync feature
  const { data: maxWcaId } = useQuery({
    queryKey: ["max-wca-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("wca_id")
        .not("wca_id", "is", null)
        .order("wca_id", { ascending: false })
        .limit(1)
        .single();
      return data?.wca_id || 0;
    },
  });

  const handleSyncNew = () => {
    if (maxWcaId) {
      setStartId(maxWcaId + 1);
      setEndId(maxWcaId + 50);
      toast({ title: "Sync impostato", description: `Cercherò nuovi partner da ID ${maxWcaId + 1} a ${maxWcaId + 50}` });
    }
  };

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
    const localStats = { found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 };

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
          log.city = result.partner?.city;
          log.countryCode = result.partner?.country_code;
          log.countryName = result.partner?.country_name;
          log.partner = result.partner;
          log.partnerId = result.partnerId;
          log.aiClassification = result.aiClassification;
          // Check if contacts have email or phone
          const contacts = result.partner?.contacts || [];
          log.hasContactDetails = contacts.some((c: any) => c.email || c.phone || c.direct_phone || c.mobile); // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
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
      setProcessedCount(processed);

      if (id < endId && !abortRef.current) {
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
      description: `Trovati: ${localStats.found}, Nuovi: ${localStats.inserted}, Aggiornati: ${localStats.updated}`,
    });
  };

  const handleLogClick = (log: ScrapeLog) => {
    if (log.status === "success" && log.partner) {
      setSelectedLog(log);
      setModalOpen(true);
    }
  };

  const total = Math.max(0, endId - startId + 1);
  const foundLogs = logs.filter((l) => l.status === "success");

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

          {/* Sync button */}
          {maxWcaId && !isLoading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm flex-1">
                Ultimo ID nel DB: <strong>{maxWcaId}</strong>
              </span>
              <Button variant="outline" size="sm" onClick={handleSyncNew}>
                Cerca nuovi partner
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleScrape} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scraping + Analisi AI...
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
                ID: {currentId} — Trovati: {stats.found} — {processedCount} di {total}
                {countdown > 0 && ` — Prossimo tra ${countdown}s`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats summary */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Risultati ({foundLogs.length} partner trovati)
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

            {/* Real-time partner list */}
            <div className="space-y-1 max-h-80 overflow-y-auto border rounded-lg">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-sm py-2 px-3 border-b last:border-0 ${
                    log.status === "success" && log.hasContactDetails
                      ? "cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 border-l-2 border-l-emerald-500 transition-colors"
                      : log.status === "success"
                        ? "cursor-pointer hover:bg-muted/50 transition-colors"
                        : ""
                  }`}
                  onClick={() => handleLogClick(log)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">#{log.wcaId}</span>
                    {log.status === "success" && (
                      <div className="flex flex-col min-w-0 gap-0.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-medium truncate">{log.companyName}</span>
                          <span className="text-muted-foreground text-xs hidden sm:inline">
                            <MapPin className="w-3 h-3 inline mr-0.5" />
                            {log.city}{log.countryCode ? `, ${log.countryCode}` : ""}
                          </span>
                        </div>
                        {log.hasContactDetails && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500 text-emerald-600 dark:text-emerald-400">
                            📧 Contatti completi
                          </Badge>
                        )}
                        {log.aiClassification?.summary && (
                          <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                            {log.aiClassification.summary}
                          </p>
                        )}
                      </div>
                    )}
                    {log.status === "not_found" && (
                      <span className="text-muted-foreground">Non trovato</span>
                    )}
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
              {logs.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-6">
                  I partner appariranno qui durante lo scraping
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <PartnerDetailModal
        partner={selectedLog?.partner ?? null}
        partnerId={selectedLog?.partnerId}
        aiClassification={selectedLog?.aiClassification}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
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
