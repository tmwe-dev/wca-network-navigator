import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Loader2, ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet, Calendar, MapPin, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useBlacklistStats, useBlacklistSyncLog, useImportBlacklist, BlacklistEntry } from "@/hooks/useBlacklist";
import { invokeEdge } from "@/lib/api/invokeEdge";
// ExcelJS loaded lazily to reduce bundle size
const getExcelJS = () => import("exceljs").then(m => m.default);
import { createLogger } from "@/lib/log";

const log = createLogger("BlacklistManager");

/* ── Parse XLS/CSV file ── */
async function parseBlacklistFile(file: File): Promise<Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[]> {
  const buffer = await file.arrayBuffer();
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();

  if (file.name.endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    const blob = new Blob([text], { type: "text/csv" });
    const stream = blob.stream() as any;
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("No worksheet found");

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || "").trim();
  });

  const entries: Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const obj: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      obj[headers[colNumber] || `col${colNumber}`] = String(cell.value ?? "");
    });

    const no = parseInt(String(obj["No."] || obj["No"] || "0"));
    const totalStr = String(obj["TotalOwedAmount"] || obj["Total Owed Amount"] || "0").replace(/[^0-9.-]/g, "");

    const entry = {
      blacklist_no: isNaN(no) ? null : no,
      company_name: String(obj["CompanyName"] || obj["Company Name"] || "").trim(),
      city: String(obj["City"] || "").trim() || null,
      country: String(obj["Country"] || "").trim() || null,
      status: String(obj["Status"] || "").trim() || null,
      claims: String(obj["Claims"] || "").trim() || null,
      total_owed_amount: parseFloat(totalStr) || null,
      matched_partner_id: null,
      source: "manual" as const,
    };

    if (entry.company_name.length > 0) entries.push(entry);
  });

  return entries;
}

export default function BlacklistManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [allParsed, setAllParsed] = useState<any[]>([]);
  const [scraping, setScraping] = useState(false);

  const { data: stats, isLoading: statsLoading } = useBlacklistStats();
  const { data: logs } = useBlacklistSyncLog();
  const importMutation = useImportBlacklist();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const entries = await parseBlacklistFile(file);
      setAllParsed(entries);
      setPreview(entries.slice(0, 10));
      toast.success(`${entries.length} record trovati nel file`);
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Errore nel parsing del file");
    }
  };

  const handleImport = async () => {
    if (allParsed.length === 0) return;
    try {
      const result = await importMutation.mutateAsync(allParsed as any);
      toast.success(`Importati ${result.imported} record, ${result.matched} match trovati`);
      setPreview(null);
      setAllParsed([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast.error("Errore importazione: " + (err.message || "Sconosciuto"));
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const data = await invokeEdge<any>("scrape-wca-blacklist", { context: "BlacklistManager.scrape_wca_blacklist" });
      if (data?.success) {
        toast.success(`Scraping completato: ${data.entries_count || 0} record, ${data.matched_count || 0} match`);
      } else {
        toast.error(data?.error || "Scraping fallito");
      }
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Sconosciuto"));
    } finally {
      setScraping(false);
    }
  };

  const daysSinceUpdate = stats?.lastUpdated
    ? Math.floor((Date.now() - new Date(stats.lastUpdated).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsLoading ? "..." : stats?.total || 0}</p>
              <p className="text-xs text-muted-foreground">Aziende in blacklist</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{statsLoading ? "..." : stats?.matched || 0}</p>
              <p className="text-xs text-muted-foreground">Match con i nostri partner</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {statsLoading ? "..." : daysSinceUpdate !== null ? `${daysSinceUpdate}g fa` : "Mai"}
              </p>
              <p className="text-xs text-muted-foreground">Ultimo aggiornamento</p>
              {daysSinceUpdate !== null && daysSinceUpdate > 7 && (
                <Badge variant="destructive" className="mt-1 text-[10px]">⚠️ Aggiornamento richiesto</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Importa Blacklist</CardTitle>
              <CardDescription>Carica il file Excel/CSV esportato da WCA World</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Seleziona File
            </Button>
            {allParsed.length > 0 && (
              <Badge variant="secondary">{allParsed.length} record pronti</Badge>
            )}
          </div>

          {preview && preview.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Anteprima (primi 10 di {allParsed.length}):</p>
              <ScrollArea className="h-[240px] border rounded-lg">
                <div className="p-3 space-y-2">
                  {preview.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50 text-sm">
                      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{entry.blacklist_no}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.company_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{entry.city}, {entry.country}</span>
                          <Badge variant={entry.status?.toLowerCase() === "active" ? "default" : "destructive"} className="text-[10px]">
                            {entry.status}
                          </Badge>
                          {entry.total_owed_amount && (
                            <span className="flex items-center gap-0.5 text-destructive font-medium">
                              <DollarSign className="w-3 h-3" />{Number(entry.total_owed_amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button onClick={handleImport} disabled={importMutation.isPending} className="w-full">
                {importMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importazione...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Importa {allParsed.length} record</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Scraping */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Scraping Automatico</CardTitle>
              <CardDescription>Scarica la blacklist direttamente da wcaworld.com</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleScrape} disabled={scraping} className="w-full" size="lg">
            {scraping ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scraping in corso...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" /> Scrape Blacklist Ora</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Utilizza Partner Connect per analizzare la pagina WCA Blacklist e aggiornare il database
          </p>
        </CardContent>
      </Card>

      {/* Sync History */}
      {logs && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cronologia Aggiornamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {log.sync_type === "manual_import" ? "Import" : "Scrape"}
                    </Badge>
                    <span>{new Date(log.created_at!).toLocaleString("it-IT")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{log.entries_count} record</span>
                    <span>{log.matched_count} match</span>
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
