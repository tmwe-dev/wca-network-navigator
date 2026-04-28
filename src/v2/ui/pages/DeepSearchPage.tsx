/**
 * DeepSearchPage V2 — Sherlock Investigator standalone.
 * Form input (companyName/website/city) + selettore livello (Scout/Detective/Sherlock)
 * + timeline step a sinistra + tabs Markdown / Findings AI / Sintesi a destra.
 *
 * NOTE: presentation-only. Tutta la logica vive in useSherlock.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, Loader2, CheckCircle2, AlertCircle, Square, FileText,
  Sparkles, SkipForward, Globe, ListChecks,
} from "lucide-react";
import { LazyMarkdown } from "@/components/ui/lazy-markdown";
import { useSherlock } from "@/v2/hooks/useSherlock";
import { FindingsView } from "@/v2/ui/pages/email-forge/sherlock/FindingsView";
import type { SherlockLevel, SherlockStepResult } from "@/v2/services/sherlock/sherlockTypes";
import { cn } from "@/lib/utils";

const LEVEL_META: Record<SherlockLevel, { label: string; icon: string; eta: string; desc: string }> = {
  1: { label: "Scout",     icon: "🔍", eta: "~30s",  desc: "Quick pass: sito + LinkedIn base" },
  2: { label: "Detective", icon: "🕵️", eta: "~2min", desc: "Cross-reference + decisori" },
  3: { label: "Sherlock",  icon: "🎩", eta: "~5min", desc: "Indagine approfondita multi-fonte" },
};

function StatusIcon({ status }: { status: SherlockStepResult["status"] }) {
  if (status === "running") return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
  if (status === "done")    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === "error")   return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  if (status === "skipped") return <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "cached")  return <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />;
  return <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40" />;
}

export function DeepSearchPage(): React.ReactElement {
  const [companyName, setCompanyName] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [city, setCity] = React.useState("");
  const [selectedOrder, setSelectedOrder] = React.useState<number | null>(null);

  const vars = React.useMemo<Record<string, string>>(() => ({
    companyName: companyName.trim(),
    city: city.trim(),
    websiteUrl: website.trim(),
    query: `${companyName} ${city}`.trim(),
    linkedinCompanySlug: "",
  }), [companyName, city, website]);

  const sherlock = useSherlock({
    partnerId: null,
    contactId: null,
    targetLabel: companyName || null,
    vars,
  });

  React.useEffect(() => {
    if (sherlock.stepResults.length > 0 && selectedOrder === null) {
      setSelectedOrder(sherlock.stepResults[sherlock.stepResults.length - 1].order);
    }
  }, [sherlock.stepResults, selectedOrder]);

  // Listener evento "sherlock-new" dal MissionDrawer
  React.useEffect(() => {
    const onNew = () => { sherlock.reset(); setSelectedOrder(null); };
    window.addEventListener("sherlock-new", onNew);
    return () => window.removeEventListener("sherlock-new", onNew);
  }, [sherlock]);

  const canStart = !!companyName.trim() && !sherlock.running;
  const selectedStep = sherlock.stepResults.find((s) => s.order === selectedOrder) ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header con form */}
      <div className="border-b border-border/50 bg-gradient-to-b from-primary/[0.03] to-transparent p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Sherlock Investigator</h2>
          <Badge variant="outline" className="text-[10px]">3 livelli</Badge>
          {sherlock.running && (
            <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Indagine in corso · Liv. {sherlock.currentLevel}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Company *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Es. Acme Logistics" disabled={!!sherlock.running} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Website (opzionale)</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" disabled={!!sherlock.running} />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Città / Country</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Milano" disabled={!!sherlock.running} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {([1, 2, 3] as const).map((lvl) => {
            const meta = LEVEL_META[lvl];
            const isActive = sherlock.running === lvl;
            return (
              <Button
                key={lvl}
                size="sm"
                variant={isActive ? "default" : "outline"}
                disabled={!canStart && !isActive}
                onClick={() => sherlock.start(lvl)}
                className="gap-2"
              >
                <span>{meta.icon}</span>
                <span className="font-medium">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">{meta.eta}</span>
              </Button>
            );
          })}
          {sherlock.running ? (
            <Button size="sm" variant="destructive" onClick={sherlock.stop} className="gap-2 ml-auto">
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          ) : sherlock.stepResults.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => { sherlock.reset(); setSelectedOrder(null); }} className="ml-auto">
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {/* Body: timeline + content */}
      {sherlock.stepResults.length === 0 && !sherlock.running ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md p-6">
            <Sparkles className="w-10 h-10 text-primary/50 mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-2">Indaga su qualsiasi azienda</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Inserisci almeno il nome company e scegli un livello: Scout (rapido),
              Detective (medio) o Sherlock (profondo).
            </p>
            <div className="grid grid-cols-3 gap-2 text-left">
              {([1, 2, 3] as const).map((lvl) => (
                <div key={lvl} className="p-2 rounded border border-border/50 bg-card/50">
                  <div className="text-base">{LEVEL_META[lvl].icon}</div>
                  <div className="text-xs font-semibold">{LEVEL_META[lvl].label}</div>
                  <div className="text-[10px] text-muted-foreground">{LEVEL_META[lvl].desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
          {/* Timeline step */}
          <div className="col-span-4 lg:col-span-3 border-r border-border/50 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Step</span>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {sherlock.stepResults.filter((s) => s.status === "done").length}/{sherlock.stepResults.length}
              </Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sherlock.stepResults.map((s) => (
                  <button
                    key={s.order}
                    onClick={() => setSelectedOrder(s.order)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs flex items-start gap-2 hover:bg-muted/50 transition",
                      selectedOrder === s.order && "bg-primary/10 border border-primary/20",
                    )}
                  >
                    <StatusIcon status={s.status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.label}</div>
                      {s.url && <div className="text-[10px] text-muted-foreground truncate">{s.url}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Detail tabs */}
          <div className="col-span-8 lg:col-span-9 overflow-hidden flex flex-col">
            <Tabs defaultValue="findings" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="rounded-none border-b border-border/50 bg-transparent h-9 px-3 justify-start gap-2">
                <TabsTrigger value="findings" className="text-xs"><Sparkles className="w-3 h-3 mr-1" />Findings AI</TabsTrigger>
                <TabsTrigger value="markdown" className="text-xs"><FileText className="w-3 h-3 mr-1" />Markdown</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs"><Globe className="w-3 h-3 mr-1" />Sintesi</TabsTrigger>
              </TabsList>

              <TabsContent value="findings" className="flex-1 overflow-auto p-4 m-0">
                {selectedStep ? (
                  <FindingsView findings={selectedStep.findings} suggestedNextUrl={selectedStep.suggested_next_url} />
                ) : (
                  <div className="text-xs text-muted-foreground">Seleziona uno step.</div>
                )}
              </TabsContent>

              <TabsContent value="markdown" className="flex-1 overflow-auto p-4 m-0">
                {selectedStep?.markdown ? (
                  <LazyMarkdown content={selectedStep.markdown} />
                ) : (
                  <div className="text-xs text-muted-foreground">Nessun markdown disponibile.</div>
                )}
              </TabsContent>

              <TabsContent value="summary" className="flex-1 overflow-auto p-4 m-0 space-y-4">
                {sherlock.summary ? (
                  <LazyMarkdown content={sherlock.summary} />
                ) : (
                  <div className="text-xs text-muted-foreground">Sintesi disponibile a fine indagine.</div>
                )}
                {Object.keys(sherlock.consolidated).length > 0 && (
                  <div className="border-t border-border/50 pt-3">
                    <div className="text-xs font-semibold mb-2">Findings consolidati</div>
                    <FindingsView findings={sherlock.consolidated} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
