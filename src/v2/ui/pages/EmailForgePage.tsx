/**
 * EmailForgePage — Prompt LAB + Calibrazione AI.
 * 3 pannelli + barra inferiore "Cosa legge l'AI" (Deep Search, KB, Mittente, Dottrina, Storico).
 */
import * as React from "react";
import { Wand2 } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEmailForge } from "@/v2/hooks/useEmailForge";
import { ForgeOraclePanel, type ForgeConfig } from "./email-forge/ForgeOraclePanel";
import { PromptInspector } from "./email-forge/PromptInspector";
import { ResultPanel } from "./email-forge/ResultPanel";
import { LabBottomTabs } from "./email-forge/LabBottomTabs";
import type { ForgeRecipient } from "./email-forge/ForgeRecipientPicker";
import type { EmailType } from "@/data/defaultEmailTypes";

export function EmailForgePage(): React.ReactElement {
  const forge = useEmailForge();
  const lastConfigRef = React.useRef<ForgeConfig | null>(null);
  const [recipient, setRecipient] = React.useState<ForgeRecipient | null>(null);
  const [emailType, setEmailType] = React.useState<EmailType | null>(null);

  const buildBaseParams = React.useCallback((cfg: ForgeConfig) => {
    const goalParts: string[] = [];
    if (cfg.customGoal.trim()) goalParts.push(cfg.customGoal.trim());
    if (cfg.emailType?.prompt) goalParts.push(cfg.emailType.prompt);
    const r = cfg.recipient;
    return {
      partner_id: r?.partnerId ?? null,
      contact_id: r?.contactId ?? null,
      recipient_name: r?.contactName ?? "",
      recipient_company: r?.companyName ?? "",
      recipient_countries: r?.countryName ?? r?.countryCode ?? "",
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

  const handleRefreshGeneration = React.useCallback(() => {
    const cfg = lastConfigRef.current;
    if (!cfg) return;
    forge.run(buildBaseParams(cfg));
  }, [forge, buildBaseParams]);

  const dbg = forge.result?._debug;
  const hasRecipient = !!forge.result?.partner_name || !!recipient;

  return (
    <div data-testid="page-email-forge" className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Email Forge — Lab AI</h1>
            <p className="text-[11px] text-muted-foreground">
              Modifica destinatario, prompt, KB, profilo e dottrina; rigenera per misurare l'impatto.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={24} minSize={20} maxSize={38}>
            <ForgeOraclePanel
              onRun={handleRun}
              isLoading={forge.isLoading}
              onRecipientChange={setRecipient}
              onEmailTypeChange={setEmailType}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={46} minSize={28}>
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
        recipient={recipient}
        emailKbCategories={emailType?.kb_categories ?? null}
        onRefreshGeneration={handleRefreshGeneration}
      />
    </div>
  );
}
