/**
 * EmailForgePage — Prompt LAB + Calibrazione AI.
 * Configurazione (destinatario / tipo / tono / KB / goal) è nella SIDEBAR
 * (linguetta laterale), come nelle altre pagine. Questa pagina mostra
 * solo: riepilogo destinatario · prompt · risultato · pannello "Cosa legge l'AI".
 */
import * as React from "react";
import { Wand2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEmailForge } from "@/v2/hooks/useEmailForge";
import { useForgeLab, forgeLabStore } from "@/v2/hooks/useForgeLabStore";
import { ForgeSummaryPanel } from "./email-forge/ForgeSummaryPanel";
import { PromptInspector } from "./email-forge/PromptInspector";
import { ResultPanel } from "./email-forge/ResultPanel";
import { LabBottomTabs } from "./email-forge/LabBottomTabs";

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

  const handleRun = React.useCallback(() => {
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

  return (
    <div data-testid="page-email-forge" className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Email Forge — Lab AI</h1>
            <p className="text-[11px] text-muted-foreground">
              Apri la <span className="font-medium">linguetta filtri</span> a sinistra per scegliere destinatario, tipo email e KB.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openDrawer} className="h-8 text-xs gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Configura
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={forge.isLoading}
            className="h-8 text-xs gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {forge.isLoading ? "Generazione…" : "Genera + Ispeziona"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={22} minSize={18} maxSize={32}>
            <ForgeSummaryPanel onOpenDrawer={openDrawer} />
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={48} minSize={28}>
            <PromptInspector
              systemPrompt={dbg?.systemPrompt}
              userPrompt={dbg?.userPrompt}
              systemBlocks={dbg?.systemBlocks}
              blocks={dbg?.blocks}
              isLoading={forge.isLoading}
              onRerun={handleRerunWithOverrides}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={30} minSize={20}>
            <ResultPanel
              result={forge.result}
              isLoading={forge.isLoading}
              error={forge.error}
              elapsedMs={forge.elapsedMs}
              hasRecipient={hasRecipient}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <LabBottomTabs
        recipient={lab.recipient}
        emailKbCategories={lab.emailType?.kb_categories ?? null}
        onRefreshGeneration={handleRun}
      />
    </div>
  );
}

// Re-export per backwards compatibility con import esistenti.
export { forgeLabStore };
