/**
 * EmailForgePage — Lab pubblico del prompt.
 * 3 pannelli affiancati: Oracolo (sx) → Prompt assemblato (centro) → Risultato (dx).
 * Mostra in tempo reale come l'Oracolo costruisce il prompt e cosa produce.
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

  const handleRun = React.useCallback((cfg: ForgeConfig) => {
    const goalParts: string[] = [];
    if (cfg.customGoal.trim()) goalParts.push(cfg.customGoal.trim());
    if (cfg.emailType?.prompt) goalParts.push(cfg.emailType.prompt);
    const goal = goalParts.join("\n\n");

    forge.run({
      partner_id: null,
      recipient_name: cfg.recipientName,
      recipient_company: cfg.recipientCompany,
      recipient_countries: cfg.recipientCountry,
      oracle_type: cfg.emailType?.id,
      oracle_tone: cfg.tone,
      use_kb: cfg.useKB,
      goal,
      base_proposal: cfg.baseProposal || undefined,
      quality: cfg.quality,
      email_type_prompt: cfg.emailType?.prompt ?? null,
      email_type_structure: cfg.emailType?.structure ?? null,
      email_type_kb_categories: cfg.emailType?.kb_categories,
    });
  }, [forge]);

  const dbg = forge.result?._debug;
  const hasRecipient = !!forge.result?.partner_name;

  return (
    <div data-testid="page-email-forge" className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Email Forge</h1>
            <p className="text-[11px] text-muted-foreground">
              Lab pubblico del prompt — vedi in tempo reale come l'Oracolo costruisce ogni blocco.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <ForgeOraclePanel onRun={handleRun} isLoading={forge.isLoading} />
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={30}>
            <PromptInspector
              systemPrompt={dbg?.systemPrompt}
              userPrompt={dbg?.userPrompt}
              systemBlocks={dbg?.systemBlocks}
              blocks={dbg?.blocks}
              isLoading={forge.isLoading}
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
