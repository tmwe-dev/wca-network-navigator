import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface TestScenario {
  id: number;
  name: string;
  endpoint: "generate-email" | "generate-outreach" | "improve-email";
  payload: Record<string, any>;
  expectedChecks: {
    language?: string;
    hasKB?: boolean;
    maxWords?: number;
    noHTML?: boolean;
    hasSubject?: boolean;
    containsKeyword?: string[];
    notContainsKeyword?: string[];
  };
}

interface TestResult {
  id: number;
  status: "pass" | "fail" | "warn" | "running" | "pending";
  output?: string;
  subject?: string;
  debug?: any;
  issues: string[];
  score: number;
  durationMs?: number;
}

const SCENARIOS: TestScenario[] = [
  // --- GENERATE-EMAIL (standalone) ---
  { id: 1, name: "Email primo contatto → DE (tedesco)", endpoint: "generate-email", payload: { standalone: true, goal: "Primo contatto con freight forwarder tedesco", oracle_type: "primo_contatto", oracle_tone: "professionale", use_kb: true, quality: "standard", recipient_countries: "Germania", language: "deutsch" }, expectedChecks: { hasSubject: true, hasKB: true } },
  { id: 2, name: "Email primo contatto → UK (inglese)", endpoint: "generate-email", payload: { standalone: true, goal: "First contact with logistics company in London", oracle_type: "primo_contatto", oracle_tone: "professionale", use_kb: true, quality: "standard", recipient_countries: "UK", language: "english" }, expectedChecks: { hasSubject: true, hasKB: true } },
  { id: 3, name: "Email follow-up → FR (francese)", endpoint: "generate-email", payload: { standalone: true, goal: "Follow-up après premier contact sans réponse", oracle_type: "follow_up", oracle_tone: "diretto", use_kb: true, quality: "premium", recipient_countries: "Francia", language: "français" }, expectedChecks: { hasSubject: true, hasKB: true } },
  { id: 4, name: "Email proposta servizi → IT", endpoint: "generate-email", payload: { standalone: true, goal: "Proporre servizio air freight con FindAir a spedizioniere italiano", oracle_type: "proposta_servizi", oracle_tone: "caloroso", use_kb: true, quality: "standard", recipient_countries: "Italia" }, expectedChecks: { hasSubject: true, containsKeyword: ["FindAir"] } },
  { id: 5, name: "Email partnership → ES (spagnolo)", endpoint: "generate-email", payload: { standalone: true, goal: "Proponer alianza estratégica para rutas Sudamérica", oracle_type: "partnership", oracle_tone: "professionale", use_kb: true, quality: "standard", recipient_countries: "Spagna", language: "español" }, expectedChecks: { hasSubject: true } },
  { id: 6, name: "Email fast quality → BR (portoghese)", endpoint: "generate-email", payload: { standalone: true, goal: "Contato inicial com empresa de logística brasileira", oracle_type: "primo_contatto", oracle_tone: "professionale", use_kb: true, quality: "fast", recipient_countries: "Brasile", language: "português" }, expectedChecks: { hasSubject: true } },
  { id: 7, name: "Email premium quality → JP (inglese)", endpoint: "generate-email", payload: { standalone: true, goal: "Premium outreach to Japanese freight forwarder for Asia-Europe lane", oracle_type: "primo_contatto", oracle_tone: "formale", use_kb: true, quality: "premium", recipient_countries: "Giappone", language: "english" }, expectedChecks: { hasSubject: true, hasKB: true } },
  { id: 8, name: "Email richiesta info → NL (olandese)", endpoint: "generate-email", payload: { standalone: true, goal: "Richiesta informazioni su servizi warehouse in Rotterdam", oracle_type: "richiesta", oracle_tone: "diretto", use_kb: true, quality: "standard", recipient_countries: "Paesi Bassi", language: "nederlands" }, expectedChecks: { hasSubject: true } },

  // --- GENERATE-OUTREACH (email channel) ---
  { id: 9, name: "Outreach email → DE con nome", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Schenker AG", contact_name: "Klaus Weber", country_code: "DE", goal: "Partnership spedizioni Italia-Germania", quality: "standard" }, expectedChecks: { hasSubject: true } },
  { id: 10, name: "Outreach email → IT senza nome", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Savino Del Bene Spa", country_code: "IT", goal: "Proporre collaborazione air freight", quality: "standard" }, expectedChecks: { hasSubject: true, notContainsKeyword: ["Savino Del Bene Spa"] } },
  { id: 11, name: "Outreach email → US premium", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Expeditors International", contact_name: "John Smith", contact_email: "john@expeditors.com", country_code: "US", goal: "Cross-selling ocean + air freight services", quality: "premium" }, expectedChecks: { hasSubject: true } },
  { id: 12, name: "Outreach email → TR (turco)", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Arkas Lojistik", contact_name: "Mehmet Yilmaz", country_code: "TR", goal: "Nuova partnership per trade lane Turchia-Italia", quality: "standard" }, expectedChecks: { hasSubject: true } },
  { id: 13, name: "Outreach email → IN (inglese)", endpoint: "generate-outreach", payload: { channel: "email", company_name: "JM Baxi Group", contact_name: "Raj Patel", country_code: "IN", goal: "Expand India-Europe logistics corridor", quality: "standard" }, expectedChecks: { hasSubject: true } },

  // --- GENERATE-OUTREACH (LinkedIn) ---
  { id: 14, name: "LinkedIn → IT breve", endpoint: "generate-outreach", payload: { channel: "linkedin", company_name: "Geodis Italia", contact_name: "Marco Bianchi", country_code: "IT", goal: "Connessione per sinergie logistiche", quality: "fast" }, expectedChecks: { noHTML: true, maxWords: 300, notContainsKeyword: ["Subject:"] } },
  { id: 15, name: "LinkedIn → UK professionale", endpoint: "generate-outreach", payload: { channel: "linkedin", company_name: "Flexport Ltd", contact_name: "Sarah Johnson", country_code: "GB", goal: "Discuss digital freight forwarding synergies", quality: "standard" }, expectedChecks: { noHTML: true, maxWords: 300 } },
  { id: 16, name: "LinkedIn → FR", endpoint: "generate-outreach", payload: { channel: "linkedin", company_name: "Bolloré Logistics", contact_name: "Pierre Dupont", country_code: "FR", goal: "Proposition de partenariat logistique", quality: "standard" }, expectedChecks: { noHTML: true, maxWords: 300 } },

  // --- GENERATE-OUTREACH (WhatsApp) ---
  { id: 17, name: "WhatsApp → IT breve", endpoint: "generate-outreach", payload: { channel: "whatsapp", company_name: "Fercam Spa", contact_name: "Luca Verdi", country_code: "IT", goal: "Conferma appuntamento di domani", quality: "fast" }, expectedChecks: { noHTML: true, maxWords: 150, notContainsKeyword: ["Subject:"] } },
  { id: 18, name: "WhatsApp → ES (spagnolo)", endpoint: "generate-outreach", payload: { channel: "whatsapp", company_name: "Sertrans", contact_name: "Carlos Lopez", country_code: "ES", goal: "Confirmar reunión y proponer agenda", quality: "fast" }, expectedChecks: { noHTML: true, maxWords: 150 } },
  { id: 19, name: "WhatsApp → DE (tedesco)", endpoint: "generate-outreach", payload: { channel: "whatsapp", company_name: "Hellmann Worldwide", contact_name: "Anna Schmidt", country_code: "DE", goal: "Termin bestätigung für morgen", quality: "fast" }, expectedChecks: { noHTML: true, maxWords: 150 } },

  // --- IMPROVE-EMAIL ---
  { id: 20, name: "Migliora email generica IT", endpoint: "improve-email", payload: { html_body: "<p>Ciao, volevo proporvi una collaborazione. Siamo un'azienda di spedizioni. Fateci sapere se siete interessati. Grazie.</p>", goal: "Rendere professionale e persuasiva", quality: "standard" }, expectedChecks: { hasKB: true } },
  { id: 21, name: "Migliora email con errori EN", endpoint: "improve-email", payload: { html_body: "<p>Hello, we are a company that do shipping. We want to work with you. Please contact us back. Thanks.</p>", goal: "Professional B2B rewrite with clear value proposition", quality: "standard" }, expectedChecks: {} },
  { id: 22, name: "Migliora email troppo lunga", endpoint: "improve-email", payload: { html_body: "<p>Gentile responsabile, le scrivo per presentarle la nostra azienda che opera nel settore delle spedizioni internazionali da oltre 25 anni. Siamo specializzati in trasporto aereo, marittimo, terrestre e corriere espresso. Operiamo in tutto il mondo con una rete di oltre 5000 agenti in 190 paesi. Abbiamo uffici in Italia, India e USA. La nostra piattaforma tecnologica proprietaria FindAir permette di prenotare spedizioni in tempo reale. Vorremmo proporvi una collaborazione per le vostre spedizioni internazionali. Siamo certi che potremmo offrirvi un servizio di qualità superiore a prezzi competitivi. Restiamo a disposizione per qualsiasi informazione. Cordiali saluti.</p>", goal: "Accorciare e rendere più incisiva", quality: "standard" }, expectedChecks: {} },

  // --- EDGE CASES ---
  { id: 23, name: "Email senza goal", endpoint: "generate-email", payload: { standalone: true, oracle_type: "primo_contatto", oracle_tone: "professionale", use_kb: true, quality: "fast", recipient_countries: "Italia" }, expectedChecks: { hasSubject: true } },
  { id: 24, name: "Outreach con nome=ruolo (Department)", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Maersk Line", contact_name: "Pricing Department", country_code: "DK", goal: "Request for rate agreement", quality: "standard" }, expectedChecks: { hasSubject: true, notContainsKeyword: ["Dear Pricing", "Caro Pricing"] } },
  { id: 25, name: "Outreach con azienda con suffisso legale", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Global Transport Solutions S.r.l.", contact_name: "Anna Rossi", country_code: "IT", goal: "Proporre servizi di trasporto aereo", quality: "standard" }, expectedChecks: { hasSubject: true } },
  
  // --- MULTI-LANGUAGE CONSISTENCY ---
  { id: 26, name: "Email → PL (polacco)", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Rohlig Suus", contact_name: "Jan Kowalski", country_code: "PL", goal: "Propozycja współpracy logistycznej", quality: "standard" }, expectedChecks: { hasSubject: true } },
  { id: 27, name: "Email → RO (rumeno)", endpoint: "generate-outreach", payload: { channel: "email", company_name: "FanCourier", contact_name: "Ion Popescu", country_code: "RO", goal: "Propunere de parteneriat logistic", quality: "standard" }, expectedChecks: { hasSubject: true } },
  { id: 28, name: "Email → GR (greco)", endpoint: "generate-outreach", payload: { channel: "email", company_name: "Goldair Handling", contact_name: "Nikos Papadopoulos", country_code: "GR", goal: "Partnership proposal for Mediterranean routes", quality: "standard" }, expectedChecks: { hasSubject: true } },
  
  // --- KB TECHNIQUE CHECKS ---
  { id: 29, name: "Follow-up 3° tentativo (Voss No-question)", endpoint: "generate-email", payload: { standalone: true, goal: "Terzo follow-up senza risposta, ultimo tentativo prima di chiudere", oracle_type: "follow_up", oracle_tone: "diretto", use_kb: true, quality: "premium", recipient_countries: "Italia" }, expectedChecks: { hasSubject: true, hasKB: true } },
  { id: 30, name: "Email con tono caloroso vs formale", endpoint: "generate-email", payload: { standalone: true, goal: "Primo contatto informale con piccolo spedizioniere locale", oracle_type: "primo_contatto", oracle_tone: "caloroso", use_kb: true, quality: "standard", recipient_countries: "Italia" }, expectedChecks: { hasSubject: true } },
];

function evaluateResult(scenario: TestScenario, response: any): { issues: string[]; score: number } {
  const issues: string[] = [];
  let score = 10;
  const body = response.body || response.full_content || "";
  const subject = response.subject || "";
  const debug = response._debug || {};
  const fullContent = response.full_content || "";

  // Check subject
  if (scenario.expectedChecks.hasSubject) {
    if (!subject && !fullContent.includes("Subject:")) {
      issues.push("❌ Manca l'oggetto (Subject)");
      score -= 2;
    }
  }

  // Check KB loaded
  if (scenario.expectedChecks.hasKB) {
    if (debug.kb_loaded === false && debug.sales_kb_loaded === false) {
      issues.push("❌ KB non caricata");
      score -= 3;
    }
  }

  // Check word count
  if (scenario.expectedChecks.maxWords) {
    const wordCount = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    if (wordCount > scenario.expectedChecks.maxWords) {
      issues.push(`⚠️ Troppo lungo: ${wordCount} parole (max ${scenario.expectedChecks.maxWords})`);
      score -= 1;
    }
  }

  // Check no HTML
  if (scenario.expectedChecks.noHTML) {
    if (/<[a-z][\s\S]*>/i.test(body)) {
      issues.push("❌ Contiene HTML (non dovrebbe per questo canale)");
      score -= 2;
    }
  }

  // Check keywords present
  if (scenario.expectedChecks.containsKeyword) {
    for (const kw of scenario.expectedChecks.containsKeyword) {
      if (!body.toLowerCase().includes(kw.toLowerCase()) && !fullContent.toLowerCase().includes(kw.toLowerCase())) {
        issues.push(`⚠️ Non contiene "${kw}"`);
        score -= 1;
      }
    }
  }

  // Check keywords absent
  if (scenario.expectedChecks.notContainsKeyword) {
    for (const kw of scenario.expectedChecks.notContainsKeyword) {
      if (body.includes(kw) || fullContent.includes(kw)) {
        issues.push(`❌ Contiene "${kw}" (non dovrebbe)`);
        score -= 2;
      }
    }
  }

  // Generic quality checks
  if (body.length < 50) { issues.push("❌ Risposta troppo corta"); score -= 3; }
  if (body.includes("SkyBus")) { issues.push("❌ ALLUCINAZIONE: menziona 'SkyBus' (non esiste)"); score -= 3; }
  if (body.includes("undefined") || body.includes("null")) { issues.push("❌ Contiene 'undefined' o 'null'"); score -= 2; }

  return { issues, score: Math.max(0, score) };
}

export default function AILab() {
  const [results, setResults] = useState<Map<number, TestResult>>(new Map());
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const runSingleTest = useCallback(async (scenario: TestScenario): Promise<TestResult> => {
    const start = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return { id: scenario.id, status: "fail", issues: ["❌ Non autenticato"], score: 0 };

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${scenario.endpoint}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(scenario.payload),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return { id: scenario.id, status: "fail", issues: [`❌ HTTP ${resp.status}: ${err.slice(0, 200)}`], score: 0, durationMs: Date.now() - start };
      }

      const data = await resp.json();
      const { issues, score } = evaluateResult(scenario, data);
      
      return {
        id: scenario.id,
        status: issues.some(i => i.startsWith("❌")) ? "fail" : issues.length > 0 ? "warn" : "pass",
        output: data.body || data.full_content || "",
        subject: data.subject || "",
        debug: data._debug,
        issues,
        score,
        durationMs: Date.now() - start,
      };
    } catch (e: any) {
      return { id: scenario.id, status: "fail", issues: [`❌ Errore: ${e.message}`], score: 0, durationMs: Date.now() - start };
    }
  }, []);

  const runAllTests = useCallback(async () => {
    setRunning(true);
    const newResults = new Map<number, TestResult>();
    
    // Set all as running
    for (const s of SCENARIOS) {
      newResults.set(s.id, { id: s.id, status: "running", issues: [], score: 0 });
    }
    setResults(new Map(newResults));

    // Run in batches of 3 to avoid rate limits
    for (let i = 0; i < SCENARIOS.length; i += 3) {
      const batch = SCENARIOS.slice(i, i + 3);
      const batchResults = await Promise.all(batch.map(s => runSingleTest(s)));
      for (const r of batchResults) {
        newResults.set(r.id, r);
      }
      setResults(new Map(newResults));
      if (i + 3 < SCENARIOS.length) await new Promise(r => setTimeout(r, 1500));
    }
    
    setRunning(false);
  }, [runSingleTest]);

  const totalScore = Array.from(results.values()).reduce((sum, r) => sum + r.score, 0);
  const maxScore = SCENARIOS.length * 10;
  const passCount = Array.from(results.values()).filter(r => r.status === "pass").length;
  const failCount = Array.from(results.values()).filter(r => r.status === "fail").length;
  const warnCount = Array.from(results.values()).filter(r => r.status === "warn").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🧪 AI Lab — Test Suite</h1>
          <p className="text-muted-foreground">30 scenari di test per generate-email, generate-outreach, improve-email</p>
        </div>
        <div className="flex items-center gap-4">
          {results.size > 0 && (
            <div className="flex gap-2 text-sm">
              <Badge variant="default" className="bg-green-600">✅ {passCount}</Badge>
              <Badge variant="default" className="bg-yellow-600">⚠️ {warnCount}</Badge>
              <Badge variant="destructive">❌ {failCount}</Badge>
              <Badge variant="outline">Score: {totalScore}/{maxScore} ({Math.round(totalScore/maxScore*10000)}/10000)</Badge>
            </div>
          )}
          <Button onClick={runAllTests} disabled={running} size="lg">
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Esecuzione...</> : <><Play className="mr-2 h-4 w-4" /> Esegui 30 Test</>}
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-2">
          {SCENARIOS.map(scenario => {
            const result = results.get(scenario.id);
            const isExpanded = expandedId === scenario.id;
            
            return (
              <Card 
                key={scenario.id} 
                className={`cursor-pointer transition-all ${
                  result?.status === "pass" ? "border-green-500/30" :
                  result?.status === "fail" ? "border-red-500/30" :
                  result?.status === "warn" ? "border-yellow-500/30" :
                  result?.status === "running" ? "border-blue-500/30 animate-pulse" : ""
                }`}
                onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6">#{scenario.id}</span>
                      {result?.status === "pass" && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {result?.status === "fail" && <XCircle className="h-4 w-4 text-red-500" />}
                      {result?.status === "warn" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                      {result?.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      <CardTitle className="text-sm font-medium">{scenario.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">{scenario.endpoint}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {result?.durationMs && <span className="text-xs text-muted-foreground">{(result.durationMs/1000).toFixed(1)}s</span>}
                      {result && <Badge variant={result.score >= 8 ? "default" : result.score >= 5 ? "secondary" : "destructive"}>{result.score}/10</Badge>}
                    </div>
                  </div>
                  {result?.issues && result.issues.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {result.issues.map((issue, i) => (
                        <span key={i} className="text-xs">{issue}</span>
                      ))}
                    </div>
                  )}
                </CardHeader>
                {isExpanded && result?.output && (
                  <CardContent className="pt-0 pb-4 px-4">
                    {result.subject && <p className="text-sm font-semibold mb-2">📧 Subject: {result.subject}</p>}
                    <div 
                      className="text-sm border rounded p-3 bg-muted/30 max-h-64 overflow-auto prose prose-sm"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.output) }}
                    />
                    {result.debug && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Debug info</summary>
                        <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-32">{JSON.stringify(result.debug, null, 2)}</pre>
                      </details>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
