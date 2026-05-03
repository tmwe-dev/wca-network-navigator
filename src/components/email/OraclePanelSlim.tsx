/**
 * OraclePanelSlim — variante "snella" del pannello Oracolo destro per il
 * Compose. Mantiene SOLO obiettivo, Genera/Migliora, Deep Search trigger,
 * template/immagini e ContextSummary. I controlli "tipo email / tono /
 * brief / KB" sono migrati nella sidebar filtri sinistra
 * (`EmailComposeFiltersSection`) e letti via `useComposeAiConfig`.
 *
 * Il payload `OracleConfig` passato a `onGenerate/onImprove` è IDENTICO a
 * quello dell'OraclePanel originale: la pipeline AI a valle non cambia.
 */
import { useMemo, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OraclePanelHeader } from "./oracle/OraclePanelHeader";
import { OraclePanelGoalInput } from "./oracle/OraclePanelGoalInput";
import { OraclePanelFooter } from "./oracle/OraclePanelFooter";
import { ImageGalleryTab } from "./ImageGalleryTab";
import EnrichmentStatusBadges from "./EnrichmentStatusBadges";
import { briefToText } from "./BriefAccordion";
import { checkOracleCoherence } from "@/lib/oracleCoherence";
import { useDeepSearchTrigger } from "@/hooks/email-composer/useDeepSearchTrigger";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { useComposeAiConfig } from "@/contexts/ComposeAiConfigContext";
import type { OracleConfig } from "./OraclePanel";
import type { OracleContextSummary } from "./OracleContextPanel";

interface OraclePanelSlimProps {
  onGenerate: (config: OracleConfig) => void;
  onImprove: (config: OracleConfig) => void;
  onLoadTemplate: (subject: string, body: string) => void;
  onInsertImage?: (url: string) => void;
  generating: boolean;
  improving: boolean;
  hasBody: boolean;
  recipientPartnerId?: string | null;
  recipientCount?: number;
  contextSummary?: OracleContextSummary | null;
}

export function OraclePanelSlim({
  onGenerate,
  onImprove,
  onLoadTemplate,
  onInsertImage,
  generating,
  improving,
  hasBody,
  recipientPartnerId = null,
  recipientCount = 0,
  contextSummary = null,
}: OraclePanelSlimProps) {
  const { selectedType, tone, useKB, brief, customGoal, setCustomGoal } = useComposeAiConfig();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImages, setShowImages] = useState(false);

  const deepSearch = useDeepSearchTrigger(recipientPartnerId);

  const coherence = useMemo(
    () => checkOracleCoherence(selectedType?.id ?? null, customGoal),
    [selectedType?.id, customGoal],
  );

  const onVoiceText = useCallback((text: string) => setCustomGoal(text), [setCustomGoal]);
  const speech = useContinuousSpeech(onVoiceText);

  const { data: templates = [] } = useEmailTemplates();

  const mergedGoal = useMemo(() => {
    const base = customGoal.trim();
    const briefBlock = briefToText(brief);
    if (!briefBlock) return base;
    return base ? `${base}\n\n${briefBlock}` : briefBlock;
  }, [customGoal, brief]);

  const config: OracleConfig = {
    emailType: selectedType,
    tone,
    useKB,
    deepSearch: deepSearch.status === "fresh",
    customGoal: mergedGoal,
  };

  return (
    <div className="flex flex-col h-full border-l border-border/30 bg-muted/5">
      <OraclePanelHeader />

      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-3">
        <OraclePanelGoalInput
          selectedType={selectedType}
          customGoal={customGoal}
          coherence={coherence}
          onGoalChange={setCustomGoal}
          speech={speech}
        />

        <EnrichmentStatusBadges partnerId={recipientPartnerId} />

        <div className="flex items-center gap-1.5 px-1 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => deepSearch.trigger()}
                disabled={!deepSearch.canRun || deepSearch.status === "running"}
                className={cn(
                  "p-1.5 rounded-md border transition-all relative",
                  !deepSearch.canRun && "opacity-40 cursor-not-allowed",
                  deepSearch.status === "running" && "border-primary/30 bg-primary/10 text-primary",
                  deepSearch.status === "fresh" && "border-success/30 bg-success/10 text-success",
                  deepSearch.status === "stale" && "border-warning/30 bg-warning/10 text-warning",
                  (deepSearch.status === "missing" || deepSearch.status === "idle") &&
                    "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  deepSearch.status === "failed" && "border-destructive/30 bg-destructive/10 text-destructive",
                )}
                aria-label="Deep Search"
              >
                <Search className={cn("w-4 h-4", deepSearch.status === "running" && "animate-spin")} />
                {deepSearch.status === "fresh" && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-success" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">
              {!deepSearch.canRun
                ? "Deep Search: richiede 1 destinatario CRM"
                : deepSearch.status === "running"
                  ? "Deep Search in corso..."
                  : deepSearch.status === "fresh"
                    ? `Deep Search aggiornata (${deepSearch.ageDays}gg fa)`
                    : "Esegui Deep Search"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  if (!showTemplates) setShowImages(false);
                }}
                className={cn(
                  "p-1.5 rounded-md border transition-all",
                  showTemplates
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
                aria-label="Template"
              >
                <FileText className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Template</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setShowImages(!showImages);
                  if (!showImages) setShowTemplates(false);
                }}
                className={cn(
                  "p-1.5 rounded-md border transition-all",
                  showImages
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
                aria-label="Immagini"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Immagini</TooltipContent>
          </Tooltip>
        </div>

        {showTemplates && (
          <div className="max-h-[200px] overflow-y-auto rounded-md border border-border/30 bg-muted/20">
            {templates.length === 0 ? (
              <p className="text-xs text-foreground/70 px-2 py-4 text-center">Nessun template</p>
            ) : (
              <div className="p-1 space-y-0.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onLoadTemplate(t.name || "", t.file_url || "");
                      setShowTemplates(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px] hover:bg-muted/50 text-foreground/70 transition-colors"
                  >
                    <span className="shrink-0">📄</span>
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showImages && (
          <div className="max-h-[200px] overflow-y-auto rounded-md border border-border/30">
            <ImageGalleryTab onInsertImage={onInsertImage || (() => {})} />
          </div>
        )}
      </div>

      <OraclePanelFooter
        generating={generating}
        improving={improving}
        hasBody={hasBody}
        recipientCount={recipientCount || 0}
        contextSummary={contextSummary}
        onGenerate={() => onGenerate(config)}
        onImprove={() => onImprove(config)}
      />
    </div>
  );
}

export default OraclePanelSlim;
