import { useState, useRef, useCallback } from "react";
import { useLinkedInLookup, type SearchLogEntry } from "@/hooks/useLinkedInLookup";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TestContact {
  name: string;
  company: string;
  email?: string;
  country?: string;
  position?: string;
  difficulty: "Facile" | "Medio" | "Difficile";
}

const TEST_CONTACTS: TestContact[] = [
  { name: "Manikandan M", company: "Shiftco", position: "Operations Manager", difficulty: "Difficile" },
  { name: "Carlos Fernandez", company: "Racing Cargo", difficulty: "Difficile" },
  { name: "Sunil Mampallil Joseph", company: "Shepherd Shipping", email: "sunil@shepherdshipping.com", difficulty: "Medio" },
  { name: "Raechel Lobo", company: "Skyfer Logistic Inc.", email: "raechel@skyferlogistic.com", position: "Business Development", difficulty: "Facile" },
  { name: "Henry Zheng", company: "Genius Int'l Logistics", email: "henry.zheng@geniuslogistics.com", position: "Sales Director", country: "China", difficulty: "Medio" },
];

interface TestResult {
  contact: TestContact;
  status: "pending" | "running" | "done" | "error";
  url: string | null;
  profile: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
  log: SearchLogEntry[];
  scrapeResult: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
  error?: string;
}

type LogLine = { ts: string; level: "info" | "success" | "warn" | "error"; text: string };

const formatMethod = (method: string | null) => {
  if (method === "partner_connect_google_search") return "Google via Partner Connect";
  if (method === "linkedin_people_search") return "LinkedIn Search";
  return method || "—";
};

export default function TestLinkedInSearch() {
  const smartSearch = useLinkedInLookup();
  const liBridge = useLinkedInExtensionBridge();
  const pcBridge = useFireScrapeExtensionBridge();
  const [results, setResults] = useState<TestResult[]>(
    TEST_CONTACTS.map(c => ({ contact: c, status: "pending", url: null, profile: null, log: [], scrapeResult: null }))
  );
  const [lines, setLines] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  const log = useCallback((level: LogLine["level"], text: string) => {
    setLines(prev => [...prev, { ts: new Date().toLocaleTimeString(), level, text }]);
  }, []);

  const runTests = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;
    setLines([]);
    setResults(TEST_CONTACTS.map(c => ({ contact: c, status: "pending", url: null, profile: null, log: [], scrapeResult: null })));

    log("info", `Partner Connect: ${pcBridge.isAvailable ? "✅ rilevata" : "❌ non disponibile"}`);
    log("info", `Estensione LinkedIn: ${liBridge.isAvailable ? "✅ rilevata" : "❌ non disponibile"}`);

    let liAuthenticated = false;

    if (liBridge.isAvailable) {
      log("info", "🔐 Verifica sessione LinkedIn...");
      const authCheck = await liBridge.ensureAuthenticated(0);
      liAuthenticated = authCheck.ok;

      if (liAuthenticated) {
        log("success", "✅ Sessione LinkedIn autenticata");
      } else {
        log("warn", `⚠️ LinkedIn non autenticato (${authCheck.reason}) — niente scraping profilo e niente fallback LI`);
      }
    } else {
      log("warn", "⚠️ Estensione LinkedIn assente — userò solo Google via Partner Connect");
    }

    if (!pcBridge.isAvailable && !liAuthenticated) {
      log("error", "❌ Nessuna estensione utile disponibile per il test.");
      setRunning(false);
      return;
    }

    log(
      "info",
      pcBridge.isAvailable
        ? "🚀 Pipeline attiva: Google-first via Partner Connect, fallback LinkedIn se serve"
        : "🚀 Pipeline attiva: sola ricerca LinkedIn diretta"
    );

    let foundCount = 0;

    for (let i = 0; i < TEST_CONTACTS.length; i++) {
      if (abortRef.current) {
        log("warn", "Test interrotto dall'utente");
        break;
      }

      const contact = TEST_CONTACTS[i];
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "running" } : r));
      log("info", `━━━ Test ${i + 1}/5: ${contact.name} @ ${contact.company} ━━━`);

      try {
        const searchResult = await smartSearch.searchSingle({
          name: contact.name,
          company: contact.company,
          role: contact.position,
          ...(contact.email && { email: contact.email }),
          ...(contact.country && { country: contact.country }),
        });

        if (searchResult.url) {
          foundCount += 1;
          log("success", `URL trovata: ${searchResult.url} (metodo: ${formatMethod(searchResult.resolvedMethod)})`);
          searchResult.searchLog.forEach(entry => {
            const icon = entry.match ? "✅" : "⬚";
            log(
              entry.match ? "success" : "warn",
              `  ${icon} Step ${entry.step}: ${formatMethod(entry.method)} | "${entry.query}" → ${entry.results} risultati, confidence ${(entry.confidence * 100).toFixed(0)}% (${entry.ms}ms) ${entry.reasoning || ""}`
            );
          });

          if (liAuthenticated && liBridge.isAvailable) {
            log("info", `  🔍 Scraping profilo: ${searchResult.url}`);
            try {
              const scrapeRes = await liBridge.extractProfile(searchResult.url);
              if (scrapeRes.success && scrapeRes.profile) {
                log("success", `  📋 Nome: ${scrapeRes.profile.name || "—"} | Headline: ${scrapeRes.profile.headline || "—"}`);
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", url: searchResult.url, profile: searchResult.profile, log: searchResult.searchLog, scrapeResult: scrapeRes.profile } : r));
              } else {
                log("warn", `  ⚠️ Scraping fallito: ${scrapeRes.error || "nessun dato"}`);
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", url: searchResult.url, profile: searchResult.profile, log: searchResult.searchLog } : r));
              }
            } catch (e) {
              log("error", `  ❌ Errore scraping: ${(e as Error).message}`);
              setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", url: searchResult.url, profile: searchResult.profile, log: searchResult.searchLog } : r));
            }
          } else {
            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", url: searchResult.url, profile: searchResult.profile, log: searchResult.searchLog } : r));
          }
        } else {
          log("error", `❌ Nessun risultato per ${contact.name}`);
          searchResult.searchLog.forEach(entry => {
            log("warn", `  ⬚ Step ${entry.step}: ${formatMethod(entry.method)} | "${entry.query}" → ${entry.results} risultati (${entry.ms}ms) ${entry.reasoning || ""}`);
          });
          setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", log: searchResult.searchLog, error: "Nessun profilo trovato" } : r));
        }
      } catch (e) {
        log("error", `❌ Errore: ${(e as Error).message}`);
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: (e as Error).message } : r));
      }

      if (i < TEST_CONTACTS.length - 1 && !abortRef.current) {
        const pause = 8000 + Math.random() * 7000;
        log("info", `⏳ Pausa ${(pause / 1000).toFixed(1)}s...`);
        await new Promise(r => setTimeout(r, pause));
      }
    }

    setRunning(false);
    log("info", `━━━ Completato: ${foundCount}/5 profili trovati ━━━`);
  }, [liBridge, pcBridge, smartSearch, log]);

  const levelColor: Record<LogLine["level"], string> = {
    info: "text-blue-400",
    success: "text-green-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  const statusIcon = (s: TestResult["status"]) => {
    if (s === "pending") return <span className="text-muted-foreground">⏸</span>;
    if (s === "running") return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    if (s === "done") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🧪 Test LinkedIn Search Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            5 biglietti da visita con dati minimi — Google-first via Partner Connect
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant={pcBridge.isAvailable ? "secondary" : "outline"}>
            PC Bridge: {pcBridge.isAvailable ? "✅" : "❌"}
          </Badge>
          <Badge variant={liBridge.isAvailable ? "default" : "destructive"}>
            LI Bridge: {liBridge.isAvailable ? "✅" : "❌"}
          </Badge>
          {running ? (
            <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true; smartSearch.abort(); }}>
              <Square className="h-4 w-4 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={runTests}>
              <Play className="h-4 w-4 mr-1" /> Avvia Test
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left w-8">#</th>
              <th className="p-2 text-left">Contatto</th>
              <th className="p-2 text-left">Azienda</th>
              <th className="p-2 text-left">Dati</th>
              <th className="p-2 text-left">Difficoltà</th>
              <th className="p-2 text-left">Stato</th>
              <th className="p-2 text-left">LinkedIn URL</th>
              <th className="p-2 text-left">Headline</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-t border-border/50">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-medium">{r.contact.name}</td>
                <td className="p-2 text-muted-foreground">{r.contact.company}</td>
                <td className="p-2">
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1">nome</Badge>
                    {r.contact.email && <Badge variant="secondary" className="text-[10px] px-1">email</Badge>}
                    {r.contact.position && <Badge variant="secondary" className="text-[10px] px-1">ruolo</Badge>}
                    {r.contact.country && <Badge variant="secondary" className="text-[10px] px-1">paese</Badge>}
                  </div>
                </td>
                <td className="p-2">
                  <Badge variant={r.contact.difficulty === "Difficile" ? "destructive" : r.contact.difficulty === "Medio" ? "default" : "secondary"} className="text-[10px]">
                    {r.contact.difficulty}
                  </Badge>
                </td>
                <td className="p-2">{statusIcon(r.status)}</td>
                <td className="p-2">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate max-w-[200px] block">
                      {r.url.replace("https://www.linkedin.com", "")}
                    </a>
                  ) : r.status === "error" ? (
                    <span className="text-destructive text-xs">{r.error}</span>
                  ) : "—"}
                </td>
                <td className="p-2 text-xs text-muted-foreground truncate max-w-[200px]">
                  {r.scrapeResult?.headline || r.profile?.headline || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="bg-gray-950 border-gray-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
          <span className="text-xs text-gray-400 font-mono">Terminal — Search Log</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-gray-500" onClick={() => setLines([])}>Clear</Button>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-3 font-mono text-xs space-y-0.5">
            {lines.length === 0 && <span className="text-gray-600">Premi "Avvia Test" per iniziare...</span>}
            {lines.map((l, i) => (
              <div key={i} className={levelColor[l.level]}>
                <span className="text-gray-600 mr-2">[{l.ts}]</span>
                {l.text}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
