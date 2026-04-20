/**
 * EmailForgePage — Prompt LAB.
 * 3 pannelli: Oracolo (sx) → Prompt assemblato/EDITABILE (centro) → Risultato (dx).
 * Permette di modificare ogni blocco e rigenerare con prompt custom.
 */
import * as React from "react";
import { Wand2 } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEmailForge } from "@/v2/hooks/useEmailForge";
import { ForgeOraclePanel, type ForgeConfig } from "./email-forge/ForgeOraclePanel";
import { PromptInspector } from "./email-forge/PromptInspector";
import { ResultPanel } from "./email-forge/ResultPanel";

export function EmailForgePage(): React.ReactElement {
  const forge = useEmailForge();
  // Memorizza l'ultima configurazione Oracolo per riusarla nel rerun con override
  const lastConfigRef = React.useRef<ForgeConfig | null>(null);

  const buildBaseParams = React.useCallback((cfg: ForgeConfig) => {
    const goalParts: string[] = [];
    if (cfg.customGoal.trim()) goalParts.push(cfg.customGoal.trim());
    if (cfg.emailType?.prompt) goalParts.push(cfg.emailType.prompt);
    return {
      partner_id: null,
      recipient_name: cfg.recipientName,
      recipient_company: cfg.recipientCompany,
      recipient_countries: cfg.recipientCountry,
      oracle_type: cfg.emailType?.id,
      oracle_tone: cfg.tone,
      use_kb: cfg.useKB,
      goal: goalParts.join("\n\n"),
      base_proposal: cfg.baseProposal || undefined,
      quality: cfg.quality,
      email_type_prompt: cfg.emailType?.prompt ?? null,
      email_type_structure: cfg.emailType?.structure ?? null,
      email_type_kb_categories: cfg.emailType?.kb_categories,
    };
  }, []);

  const handleRun = React.useCallback((cfg: ForgeConfig) => {
    lastConfigRef.current = cfg;
    forge.run(buildBaseParams(cfg));
  }, [forge, buildBaseParams]);

  const handleRerunWithOverrides = React.useCallback((systemPrompt: string, userPrompt: string) => {
    const cfg = lastConfigRef.current;
    if (!cfg) return;
    forge.run({
      ...buildBaseParams(cfg),
      system_prompt_override: systemPrompt,
      user_prompt_override: userPrompt,
    });
  }, [forge, buildBaseParams]);

  const dbg = forge.result?._debug;
  const hasRecipient = !!forge.result?.partner_name;

  return (
    <div data-testid="page-email-forge" className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Email Forge — Prompt Lab</h1>
            <p className="text-[11px] text-muted-foreground">
              Modifica ogni blocco del prompt e rigenera la mail per testare l'impatto delle tue varianti.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={22} minSize={18} maxSize={35}>
            <ForgeOraclePanel onRun={handleRun} isLoading={forge.isLoading} />
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={48} minSize={30}>
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
    </div>
  );
}
