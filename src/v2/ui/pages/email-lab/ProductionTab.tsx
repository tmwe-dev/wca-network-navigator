/**
 * ProductionTab — Tab "Produzione email · serial agents".
 * In alto: pannello config (riuso ForgeOraclePanel).
 * Sotto: lista orizzontale scrollabile di card iterazioni v1, v2, v3...
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, RotateCcw, Loader2 } from "lucide-react";
import { ForgeOraclePanel, type ForgeConfig } from "@/v2/ui/pages/email-forge/ForgeOraclePanel";
import { useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { useEmailLabIterations } from "@/v2/hooks/useEmailLabIterations";
import type { ForgeRunParams } from "@/v2/hooks/useEmailForge";
import { IterationCard } from "./IterationCard";

export function ProductionTab(): React.ReactElement {
  const lab = useForgeLab();
  const iter = useEmailLabIterations();

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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* CONFIG */}
      <div className="rounded-lg border border-border/60 bg-card/40">
        <ForgeOraclePanel onRun={handleGenerate} isLoading={iter.isGenerating} />
      </div>

      {/* AZIONI */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
        <Button size="sm" onClick={() => handleGenerate()} disabled={iter.isGenerating || iter.isImproving} className="gap-1.5">
          {iter.isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Genera bozza (v{iter.iterations.length + 1})
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void iter.improve()} disabled={!iter.canImprove || iter.isImproving || iter.isGenerating} className="gap-1.5">
          {iter.isImproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Migliora bozza corrente
        </Button>
        <Button size="sm" variant="ghost" onClick={iter.reset} disabled={iter.iterations.length === 0} className="gap-1.5 text-foreground/70">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset serie
        </Button>
        <div className="ml-auto text-xs text-foreground/60">
          {iter.iterations.length === 0 ? "Nessuna iterazione" : `${iter.iterations.length} iterazione${iter.iterations.length === 1 ? "" : "i"}`}
        </div>
      </div>

      {/* ITERAZIONI in fila orizzontale */}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border/40 bg-background/30 p-3">
        {iter.iterations.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center text-center text-sm text-foreground/55">
            Configura destinatario e tipo email, poi clicca <strong className="mx-1 text-foreground/80">Genera bozza</strong>.
            <br />
            Le versioni successive (genera/migliora) appariranno affiancate qui sotto.
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
    </div>
  );
}