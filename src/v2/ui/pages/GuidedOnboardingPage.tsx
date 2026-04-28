/**
 * GuidedOnboardingPage — 5-step wizard:
 * 1. Import partner CSV
 * 2. Crea primo agente AI
 * 3. Prima missione
 * 4. Scrape primo sito
 * 5. Report
 */
import * as React from "react";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Bot, Target, Globe, FileBarChart,
  CheckCircle2, ArrowRight, ArrowLeft, Sparkles, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

type Step = {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
};

const STEPS: Step[] = [
  { id: "import", icon: Upload, title: "Importa Partner", subtitle: "Carica il tuo primo file CSV di partner" },
  { id: "agent", icon: Bot, title: "Crea Agente AI", subtitle: "Configura il tuo primo assistente intelligente" },
  { id: "mission", icon: Target, title: "Prima Missione", subtitle: "Lancia un'analisi automatica" },
  { id: "scrape", icon: Globe, title: "Scrape Sito", subtitle: "Arricchisci un partner con dati dal web" },
  { id: "report", icon: FileBarChart, title: "Report", subtitle: "Visualizza i risultati" },
];

export function GuidedOnboardingPage(): React.ReactElement {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [agentName, setAgentName] = useState("Assistente WCA");
  const [agentTone, setAgentTone] = useState("Professionale e amichevole");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const markComplete = useCallback((stepIdx: number) => {
    setCompleted(prev => new Set(prev).add(stepIdx));
  }, []);

  const next = () => {
    markComplete(current);
    if (current < STEPS.length - 1) setCurrent(current + 1);
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const markOnboardingComplete = async () => {
    const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.completed });
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      await markOnboardingComplete();
      toast.success("Onboarding completato! Benvenuto in WCA Network Navigator.");
      navigate("/v2");
    } catch {
      toast.error("Errore nel completamento");
    } finally {
      setSaving(false);
    }
  };

  const skipAll = async () => {
    setSaving(true);
    try {
      await markOnboardingComplete();
      navigate("/v2");
    } catch {
      toast.error("Errore");
    } finally {
      setSaving(false);
    }
  };

  const progress = ((completed.size) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border/40 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Setup Guidato</span>
          <Badge variant="secondary" className="text-xs">{current + 1}/{STEPS.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={skipAll} disabled={saving}>
          <X className="h-4 w-4 mr-1" /> Salta tutto
        </Button>
      </div>

      {/* Progress */}
      <div className="px-4 sm:px-6 pt-4">
        <Progress value={progress} className="h-1.5" />
        {/* Step indicators */}
        <div className="flex justify-between mt-3">
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => setCurrent(i)}
              className={cn(
                "flex flex-col items-center gap-1 text-[10px] sm:text-xs transition-colors",
                i === current ? "text-primary" : completed.has(i) ? "text-emerald-500" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors",
                i === current ? "border-primary bg-primary/10" : completed.has(i) ? "border-emerald-500 bg-emerald-500/10" : "border-border"
              )}>
                {completed.has(i) ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </div>
              <span className="hidden sm:block">{step.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                {React.createElement(STEPS[current].icon, { className: "h-5 w-5 text-primary" })}
                {STEPS[current].title}
              </CardTitle>
              <CardDescription>{STEPS[current].subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {current === 0 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Carica un file CSV con i tuoi partner logistici. Colonne supportate: company_name, email, phone, country, website.
                  </p>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/v2/import")}
                  >
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">Clicca per andare alla pagina Import</p>
                    <p className="text-xs text-muted-foreground mt-1">oppure trascina qui un file CSV</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Non hai un CSV? Puoi saltare questo step e importare dopo.</p>
                </>
              )}

              {current === 1 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Il tuo agente AI ti aiuterà ad analizzare partner, comporre email e gestire le missioni.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="agent-name">Nome dell'agente</Label>
                      <Input id="agent-name" value={agentName} onChange={e => setAgentName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="agent-tone">Tono di voce</Label>
                      <Textarea id="agent-tone" value={agentTone} onChange={e => setAgentTone(e.target.value)} rows={2} />
                    </div>
                  </div>
                  <Button onClick={() => { toast.success(`Agente "${agentName}" creato!`); next(); }} className="w-full gap-2">
                    <Bot className="h-4 w-4" /> Crea Agente
                  </Button>
                </>
              )}

              {current === 2 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Lancia la tua prima missione: l'agente analizzerà 5 partner e genererà un report sullo stato dei contatti.
                  </p>
                  <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                    <p className="text-sm font-medium">Missione suggerita:</p>
                    <p className="text-sm text-muted-foreground italic">"Analizza i primi 5 partner importati: verifica se hanno email e telefono, e suggerisci azioni per arricchire i dati mancanti."</p>
                  </div>
                  <Button onClick={() => { toast.success("Missione avviata!"); next(); }} className="w-full gap-2">
                    <Target className="h-4 w-4" /> Avvia Missione Demo
                  </Button>
                </>
              )}

              {current === 3 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Prova lo scraping intelligente: inserisci l'URL di un partner per estrarre automaticamente informazioni dal sito.
                  </p>
                  <div>
                    <Label htmlFor="scrape-url">URL del sito partner</Label>
                    <Input
                      id="scrape-url"
                      placeholder="https://example-logistics.com"
                      value={scrapeUrl}
                      onChange={e => setScrapeUrl(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => { toast.success("Scraping avviato! I risultati appariranno nella scheda del partner."); next(); }}
                    className="w-full gap-2"
                    disabled={!scrapeUrl.trim()}
                  >
                    <Globe className="h-4 w-4" /> Avvia Scraping
                  </Button>
                </>
              )}

              {current === 4 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Complimenti! Hai completato il setup guidato. Ecco un riepilogo:
                  </p>
                  <div className="space-y-2">
                    {STEPS.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                        <CheckCircle2 className={cn("h-4 w-4 shrink-0", completed.has(i) ? "text-emerald-500" : "text-muted-foreground")} />
                        <span className={completed.has(i) ? "" : "text-muted-foreground"}>{step.title}</span>
                        <Badge variant={completed.has(i) ? "default" : "secondary"} className="ml-auto text-[10px]">
                          {completed.has(i) ? "Completato" : "Saltato"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button onClick={finishOnboarding} disabled={saving} className="w-full gap-2 mt-4" size="lg">
                    <Sparkles className="h-4 w-4" /> Vai alla Dashboard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border/40 px-4 sm:px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prev} disabled={current === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>
        {current < STEPS.length - 1 && (
          <Button variant="outline" size="sm" onClick={next}>
            Salta <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
