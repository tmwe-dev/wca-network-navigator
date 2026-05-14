import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Loader2, ShieldAlert, CheckCircle2, FileSpreadsheet, Calendar, MapPin, DollarSign, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useBlacklistStats, useBlacklistSyncLog, useImportBlacklist, BlacklistEntry } from "@/hooks/useBlacklist";
// ExcelJS loaded lazily to reduce bundle size
const getExcelJS = () => import("exceljs").then(m => m.default);
import { createLogger } from "@/lib/log";

/** Soglia (giorni) oltre la quale la blacklist è considerata da aggiornare. */
const BLACKLIST_REFRESH_DAYS = 30;

const log = createLogger("BlacklistManager");

/* ── Parse XLS/XLSX/CSV file ── */
/**
 * Sniffa il contenuto reale del file (alcuni export WCA hanno estensione .xls
 * ma sono CSV con BOM UTF-8). Decide CSV vs XLSX in base ai primi byte.
 */
function looksLikeCsv(buffer: ArrayBuffer, fileName: string): boolean {
  if (fileName.toLowerCase().endsWith(".csv")) return true;
  const head = new Uint8Array(buffer.slice(0, 8));
  // XLSX/XLS (binario): zip "PK" o OLE compound D0 CF 11 E0
  if (head[0] === 0x50 && head[1] === 0x4b) return false;
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return false;
  // BOM UTF-8 → CSV
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return true;
  // Primi 200 byte: se trova virgole/tab/newline e nessun null byte → CSV
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(buffer.slice(0, 200));
  return /[,;\t]/.test(sample) && /\r|\n/.test(sample) && !/\u0000/.test(sample);
}

async function parseBlacklistFile(file: File): Promise<Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[]> {
  const buffer = await file.arrayBuffer();

  let rows: string[][];
  if (looksLikeCsv(buffer, file.name)) {
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    rows = parseCsv(text);
  } else {
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("No worksheet found");
    rows = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = String(cell.value ?? "");
      });
      rows.push(cells);
    });
  }

  if (rows.length === 0) throw new Error("Empty file");
  const headers = rows[0].map((h) => String(h || "").trim());
  const entries: Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[] = [];

  for (let i = 1; i < rows.length; i++) {
    const obj: Record<string, string> = {};
    rows[i].forEach((val, idx) => {
      obj[headers[idx] || `col${idx}`] = String(val ?? "");
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
  }

  return entries;
}

/** Parser CSV minimale RFC4180-like: gestisce quote, escape "" e newline dentro campi quotati. Rileva delimitatore , ; \t */
function parseCsv(text: string): string[][] {
  // Detect delimiter from first non-quoted line
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  const delimiter = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip, handled by \n */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v && v.trim().length > 0));
}

export default function BlacklistManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[] | null>(null);
  const [allParsed, setAllParsed] = useState<Omit<BlacklistEntry, "id" | "created_at" | "updated_at">[]>([]);

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
      const result = await importMutation.mutateAsync(allParsed);
      toast.success(`Importati ${result.imported} record, ${result.matched} match trovati`);
      setPreview(null);
      setAllParsed([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      toast.error("Errore importazione: " + ((err instanceof Error ? err.message : String(err)) || "Sconosciuto"));
    }
  };

  const daysSinceUpdate = stats?.lastUpdated
    ? Math.floor((Date.now() - new Date(stats.lastUpdated).getTime()) / 86400000)
    : null;
  const daysToNextUpdate = daysSinceUpdate === null ? null : Math.max(0, BLACKLIST_REFRESH_DAYS - daysSinceUpdate);
  const isOverdue = daysSinceUpdate !== null && daysSinceUpdate >= BLACKLIST_REFRESH_DAYS;
  const isExpiringSoon = daysSinceUpdate !== null && !isOverdue && daysToNextUpdate !== null && daysToNextUpdate <= 5;

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
              {daysSinceUpdate === null && (
                <Badge variant="destructive" className="mt-1 text-[10px]">⚠️ Mai importata</Badge>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="mt-1 text-[10px]">⚠️ Scaduta da {daysSinceUpdate! - BLACKLIST_REFRESH_DAYS}g</Badge>
              )}
              {isExpiringSoon && (
                <Badge variant="warning" className="mt-1 text-[10px]">In scadenza tra {daysToNextUpdate}g</Badge>
              )}
              {!isOverdue && !isExpiringSoon && daysToNextUpdate !== null && (
                <p className="text-[10px] text-muted-foreground mt-1">Prossimo aggiornamento tra {daysToNextUpdate}g</p>
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
              <CardDescription>
                Carica il file <code className="text-[11px]">BlackListExport-*.xls</code> esportato da WCA World (formato CSV, XLS o XLSX). Aggiornamento consigliato ogni {BLACKLIST_REFRESH_DAYS} giorni.
              </CardDescription>
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

      {/* How-to */}
      <Card>
        <CardContent className="pt-6 flex items-start gap-3">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Come aggiornare la blacklist:</strong></p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Su <code>wcaworld.com</code> esporta la blacklist in formato Excel.</li>
              <li>Carica qui sopra il file (anche con estensione <code>.xls</code> in formato CSV).</li>
              <li>L'import sostituisce gli ingressi precedenti e ri-aggancia i match con i partner CRM.</li>
              <li>Ripeti l'operazione ogni {BLACKLIST_REFRESH_DAYS} giorni: ti avviseremo in cima alla pagina quando scade.</li>
            </ol>
          </div>
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
