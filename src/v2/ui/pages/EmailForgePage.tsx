/**
 * EmailForgePage — Lab AI semplificato (LOVABLE-76B).
 * Layout 2 pannelli: ForgeOraclePanel (configurazione) | ForgeOutputPanel (Risultato/Prompt/AI).
 * Footer 1 riga con metriche tecniche. Drawer globale resta accessibile per scope avanzati.
 */
import * as React from "react";
import { Wand2, SlidersHorizontal, Cpu, Clock, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEmailForge } from "@/v2/hooks/useEmailForge";
import { useForgeLab, forgeLabStore } from "@/v2/hooks/useForgeLabStore";
import { ForgeOraclePanel, type ForgeConfig } from "./email-forge/ForgeOraclePanel";
import { ForgeOutputPanel } from "./email-forge/ForgeOutputPanel";

export function EmailForgePage(): React.ReactElement {
  const forge = useEmailForge();
  const lab = useForgeLab();
  const lastRunRef = React.useRef(0);

  const buildBaseParams = React.useCallback(() => {
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

  // Auto-run quando l'utente clicca "Genera" nel drawer
  React.useEffect(() => {
    if (lab.runCounter > 0 && lab.runCounter !== lastRunRef.current) {
      lastRunRef.current = lab.runCounter;
      forge.run(buildBaseParams());
    }
  }, [lab.runCounter, forge, buildBaseParams]);

  // CTA del pannello sinistro: usa la config corrente (già sincronizzata con lo store)
  const handleRun = React.useCallback((_config?: ForgeConfig) => {
    forge.run(buildBaseParams());
  }, [forge, buildBaseParams]);

  const handleRerunWithOverrides = React.useCallback((systemPrompt: string, userPrompt: string) => {
    forge.run({ ...buildBaseParams(), system_prompt_override: systemPrompt, user_prompt_override: userPrompt });
  }, [forge, buildBaseParams]);

  const openDrawer = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("open-drawer", { detail: { drawer: "filters" } }));
  }, []);

  const dbg = forge.result?._debug;
  const hasRecipient = !!forge.result?.partner_name || !!lab.recipient;
  const tokensIn = dbg?.tokens_in ?? null;
  const tokensOut = dbg?.tokens_out ?? null;
  const totalTokens = (tokensIn ?? 0) + (tokensOut ?? 0);
  const credits = totalTokens > 0
    ? Math.max(1, Math.ceil(((tokensIn ?? 0) + (tokensOut ?? 0) * 2) / 1000))
    : null;

  return (
    <div data-testid="page-email-forge" className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Email Forge — Lab AI</h1>
            <p className="text-xs text-foreground/70">
              Seleziona destinatario, scegli il tipo email e clicca Genera.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openDrawer} className="h-8 text-xs gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filtri globali
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={35} minSize={28} maxSize={45}>
            <ForgeOraclePanel onRun={handleRun} isLoading={forge.isLoading} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={65} minSize={45}>
            <ForgeOutputPanel
              result={forge.result}
              isLoading={forge.isLoading}
              error={forge.error}
              elapsedMs={forge.elapsedMs}
              hasRecipient={hasRecipient}
              recipient={lab.recipient}
              emailKbCategories={lab.emailType?.kb_categories ?? null}
              systemPrompt={dbg?.systemPrompt}
              userPrompt={dbg?.userPrompt}
              systemBlocks={dbg?.systemBlocks}
              blocks={dbg?.blocks}
              onRerunPrompt={handleRerunWithOverrides}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* FOOTER metriche compatto */}
      <footer className="border-t border-border/60 px-3 py-1.5 text-xs text-foreground/60 flex items-center gap-3 shrink-0 bg-card/30">
        {forge.result ? (
          <>
            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {forge.result.model}</span>
            <span>·</span>
            <span>{forge.result.quality}</span>
            {dbg?.ai_latency_ms != null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {dbg.ai_latency_ms}ms</span>
              </>
            )}
            {forge.elapsedMs != null && (
              <>
                <span>·</span>
                <span>totale {forge.elapsedMs}ms</span>
              </>
            )}
            {totalTokens > 0 && (
              <>
                <span>·</span>
                <span>{totalTokens} tok ({tokensIn ?? 0}↓ / {tokensOut ?? 0}↑)</span>
              </>
            )}
            {credits != null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> {credits} crediti</span>
              </>
            )}
          </>
        ) : (
          <span className="text-foreground/50">Nessuna generazione ancora</span>
        )}
      </footer>
    </div>
  );
}

// Re-export per backwards compatibility con import esistenti.
export { forgeLabStore };
