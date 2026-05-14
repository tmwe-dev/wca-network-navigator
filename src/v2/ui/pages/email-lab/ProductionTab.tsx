/**
 * ProductionTab — Workflow lineare a 3 step:
 *  ① Scenario di prova (preset 1-click o "parto da bianco")
 *  ② Configura destinatario + tipo (ForgeOraclePanel esistente, intoccato)
 *  ③ Lancia, itera e confronta
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, RotateCcw, Loader2 } from "lucide-react";
import { ForgeOraclePanel, type ForgeConfig } from "@/v2/ui/pages/email-forge/ForgeOraclePanel";
import { useForgeLab, forgeLabStore } from "@/v2/hooks/useForgeLabStore";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";
import { useEmailLabIterations } from "@/v2/hooks/useEmailLabIterations";
import type { ForgeRunParams } from "@/v2/hooks/useEmailForge";
import { IterationCard } from "./IterationCard";

/** Scenario preset = solo customGoal + tone + (opzionale) emailType. Destinatario lo sceglie l'utente. */
const SCENARIOS: Array<{
  id: string;
  label: string;
  desc: string;
  goal: string;
  tone: string;
  emailTypeId?: string;
}> = [
  {
    id: "primo-contatto",
    label: "Primo contatto a freddo",
    desc: "Apri una conversazione con un partner mai sentito.",
    goal: "Presenta brevemente TMWE e proponi una call introduttiva di 15 minuti.",
    tone: "professionale",
    emailTypeId: DEFAULT_EMAIL_TYPES.find((t) => /contatto|presentaz/i.test(t.name))?.id,
  },
  {
    id: "follow-up",
    label: "Follow-up dopo silenzio",
    desc: "Seconda email a chi non ha risposto dopo 7 giorni.",
    goal: "Riprendi il filo senza essere insistente, aggiungi un piccolo elemento di valore.",
    tone: "cordiale",
    emailTypeId: DEFAULT_EMAIL_TYPES.find((t) => /follow/i.test(t.name))?.id,
  },
  {
    id: "proposta",
    label: "Proposta operativa",
    desc: "Email con una proposta concreta a partner già scaldato.",
    goal: "Formalizza una proposta operativa con prossimo passo chiaro (call o documento).",
    tone: "diretto",
    emailTypeId: DEFAULT_EMAIL_TYPES.find((t) => /propos|offert/i.test(t.name))?.id,
  },
];

function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{n}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint ? <span className="text-xs text-foreground/55">— {hint}</span> : null}
    </div>
  );
}

export function ProductionTab(): React.ReactElement {
  const lab = useForgeLab();
  const iter = useEmailLabIterations();
  const [activeScenario, setActiveScenario] = React.useState<string | null>(null);

  const buildParams = React.useCallback((): ForgeRunParams => {
    const goalParts: string[] = [];
    if (lab.customGoal.trim()) goalParts.push(lab.customGoal.trim());
    if (lab.emailType?.prompt) goalParts.push(lab.emailType.prompt);
    const r = lab.recipient;
    return {
      partner_id: r?.partnerId ?? null,
      contact_id: r?.contactId ?? null,
      recipient_name: r?.contactName ?? "",
      recipient_company: r?.companyName ?? "",
      recipient_countries: r?.countryName ?? r?.countryCode ?? "",
      oracle_type: lab.emailType?.id,
      oracle_tone: lab.tone,
      use_kb: lab.useKB,
      goal: goalParts.join("\n\n"),
      base_proposal: lab.baseProposal || undefined,
      quality: lab.quality,
      email_type_prompt: lab.emailType?.prompt ?? null,
      email_type_structure: lab.emailType?.structure ?? null,
      email_type_kb_categories: lab.emailType?.kb_categories,
    };
  }, [lab]);

  const handleGenerate = React.useCallback((_cfg?: ForgeConfig) => {
    void iter.generate(buildParams());
  }, [iter, buildParams]);

  const applyScenario = React.useCallback((id: string) => {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    const et = s.emailTypeId
      ? DEFAULT_EMAIL_TYPES.find((t) => t.id === s.emailTypeId) ?? null
      : null;
    forgeLabStore.set({
      customGoal: s.goal,
      tone: s.tone,
      ...(et ? { emailType: et } : {}),
    });
    setActiveScenario(id);
  }, []);

  const clearScenario = React.useCallback(() => {
    forgeLabStore.set({ customGoal: "", tone: "professionale" });
    setActiveScenario(null);
  }, []);

  const hasRecipient = !!lab.recipient;
  const canGenerate = !iter.isGenerating && !iter.isImproving;

  return (
    <div className="flex h-full flex-col gap-5">
      {/* STEP 1 — Scenario */}
      <section className="rounded-lg border border-border/60 bg-card/40 p-4">
        <StepHeader n={1} title="Scegli uno scenario di prova" hint="opzionale, riempie obiettivo e tono" />
        <div className="grid gap-2 sm:grid-cols-3">
          {SCENARIOS.map((s) => {
            const active = activeScenario === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => applyScenario(s.id)}
                className={`rounded-md border p-3 text-left transition ${
                  active
                    ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/50 bg-background/40 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div className="text-sm font-medium text-foreground">{s.label}</div>
                <div className="mt-1 text-[11px] leading-snug text-foreground/60">{s.desc}</div>
              </button>
            );
          })}
        </div>
        {activeScenario ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-foreground/60">
            <span>Scenario attivo: <strong className="text-foreground/80">{SCENARIOS.find((s) => s.id === activeScenario)?.label}</strong></span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearScenario}>Pulisci</Button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-foreground/55">
            Salta questo passo se vuoi configurare manualmente obiettivo e tono nello step 2.
          </p>
        )}
      </section>

      {/* STEP 2 — Configurazione */}
      <section className="rounded-lg border border-border/60 bg-card/40">
        <div className="px-4 pt-4">
          <StepHeader n={2} title="Configura destinatario e tipo email" hint="serve almeno il destinatario per generare" />
        </div>
        <ForgeOraclePanel onRun={handleGenerate} isLoading={iter.isGenerating} />
      </section>

      {/* STEP 3 — Esecuzione + iterazioni */}
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 bg-card/40 p-4">
        <StepHeader n={3} title="Lancia e confronta le iterazioni" hint="ogni clic crea una nuova versione affiancata" />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleGenerate()}
            disabled={!canGenerate || !hasRecipient}
            className="gap-1.5"
          >
            {iter.isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Genera bozza (v{iter.iterations.length + 1})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void iter.improve()}
            disabled={!iter.canImprove || iter.isImproving || iter.isGenerating}
            className="gap-1.5"
          >
            {iter.isImproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Migliora bozza corrente
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={iter.reset}
            disabled={iter.iterations.length === 0}
            className="gap-1.5 text-foreground/70"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset serie
          </Button>
          <div className="ml-auto text-xs text-foreground/60">
            {iter.iterations.length === 0
              ? "Nessuna iterazione"
              : `${iter.iterations.length} iterazione${iter.iterations.length === 1 ? "" : "i"}`}
          </div>
        </div>

        {!hasRecipient && iter.iterations.length === 0 ? (
          <div className="flex flex-1 min-h-[180px] items-center justify-center rounded-md border border-dashed border-border/50 bg-background/30 px-6 text-center text-sm text-foreground/60">
            Seleziona un destinatario nello step 2 per attivare la generazione.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-md border border-border/40 bg-background/30 p-3">
            {iter.iterations.length === 0 ? (
              <div className="flex h-full min-h-[180px] items-center justify-center text-center text-sm text-foreground/55">
                Pronto. Clicca <strong className="mx-1 text-foreground/80">Genera bozza</strong> per la prima versione.
              </div>
            ) : (
              <div className="flex h-full gap-3">
                {iter.iterations.map((it, i) => (
                  <IterationCard
                    key={it.id}
                    iteration={it}
                    index={i}
                    previous={i > 0 ? iter.iterations[i - 1] : null}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}