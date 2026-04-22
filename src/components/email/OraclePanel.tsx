import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  FileText,
  ImageIcon,
  BookOpen,
} from "lucide-react";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import { checkOracleCoherence } from "@/lib/oracleCoherence";
import EmailTypeDetailDialog from "./EmailTypeDetailDialog";
import BriefAccordion, { EMPTY_BRIEF, briefToText, type EmailBrief } from "./BriefAccordion";
import { useDeepSearchTrigger } from "@/hooks/email-composer/useDeepSearchTrigger";
import { useUnifiedEnrichmentSnapshot } from "@/hooks/useUnifiedEnrichmentSnapshot";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { ImageGalleryTab } from "./ImageGalleryTab";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";
import { OraclePanelHeader } from "./oracle/OraclePanelHeader";
import { OraclePanelGoalInput } from "./oracle/OraclePanelGoalInput";
import { OraclePanelTypeChips } from "./oracle/OraclePanelTypeChips";
import { OraclePanelFooter } from "./oracle/OraclePanelFooter";
import EnrichmentStatusBadges from "./EnrichmentStatusBadges";

const log = createLogger("OraclePanel");

export interface OracleConfig {
  emailType: EmailType | null;
  tone: string;
  useKB: boolean;
  deepSearch: boolean;
  customGoal: string;
}

interface OraclePanelProps {
  onGenerate: (config: OracleConfig) => void;
  onImprove: (config: OracleConfig) => void;
  onLoadTemplate: (subject: string, body: string) => void;
  onInsertImage?: (url: string) => void;
  generating: boolean;
  improving: boolean;
  hasBody: boolean;
  recipientPartnerId?: string | null;
  recipientCount?: number;
  contextSummary?: Record<string, unknown> | null;
}

export default function OraclePanel({
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
}: OraclePanelProps) {
  const [selectedType, setSelectedType] = useState<EmailType | null>(null);
  const [tone, setTone] = useState("professionale");
  const [useKB, setUseKB] = useState(true);
  const [customGoal, setCustomGoal] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [brief, setBrief] = useState<EmailBrief>(EMPTY_BRIEF);
  const [detailType, setDetailType] = useState<EmailType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const deepSearch = useDeepSearchTrigger(recipientPartnerId);

  const coherence = useMemo(
    () => checkOracleCoherence(selectedType?.id ?? null, customGoal),
    [selectedType?.id, customGoal]
  );

  const onVoiceText = useCallback((text: string) => {
    setCustomGoal(text);
  }, []);
  const speech = useContinuousSpeech(onVoiceText);

  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const { data: templates = [] } = useEmailTemplates();

  const customTypes: EmailType[] = useMemo(() => {
    try {
      return JSON.parse(settings?.email_oracle_types || "[]");
    } catch (e) {
      log.debug("fallback used after parse failure", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    }
  }, [settings?.email_oracle_types]);

  const allTypes = useMemo(
    () => [...DEFAULT_EMAIL_TYPES, ...customTypes],
    [customTypes]
  );

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

  const handleAddType = (newType: EmailType) => {
    const updated = [...customTypes, newType];
    updateSetting.mutate({
      key: "email_oracle_types",
      value: JSON.stringify(updated),
    });
    setSelectedType(newType);
  };

  const removeCustomType = (id: string) => {
    const updated = customTypes.filter((t) => t.id !== id);
    updateSetting.mutate({
      key: "email_oracle_types",
      value: JSON.stringify(updated),
    });
    if (selectedType?.id === id) setSelectedType(null);
  };

  const handleDuplicate = (newType: EmailType) => {
    const updated = [...customTypes, newType];
    updateSetting.mutate({
      key: "email_oracle_types",
      value: JSON.stringify(updated),
    });
    setSelectedType(newType);
  };

  const openDetail = (t: EmailType) => {
    setDetailType(t);
    setDetailOpen(true);
  };

  const currentToneOption = TONE_OPTIONS.find((t) => t.value === tone);

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

        <BriefAccordion brief={brief} onChange={setBrief} />

        <OraclePanelTypeChips
          allTypes={allTypes}
          selectedType={selectedType}
          customTypes={customTypes}
          onSelectType={setSelectedType}
          onAddType={handleAddType}
          onRemoveType={removeCustomType}
          onOpenDetail={openDetail}
        />

        <EnrichmentStatusBadges partnerId={recipientPartnerId} />

        <div className="flex items-center gap-2 px-1 py-1">
          <div title={"Tono: " + (currentToneOption?.label || "Professionale")}>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-7 w-9 p-0 border-0 bg-transparent justify-center [&>svg:last-child]:hidden">
                <SlidersHorizontal className="w-4 h-4 text-foreground/70" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setUseKB(!useKB)}
                className={cn(
                  "p-1.5 rounded-md border transition-all",
                  useKB
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground/40 hover:border-primary/30 hover:text-foreground"
                )}
              >
                <BookOpen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">
              Knowledge Base: {useKB ? "attiva" : "spenta"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => deepSearch.trigger()}
                disabled={!deepSearch.canRun || deepSearch.status === "running"}
                className={cn(
                  "p-1.5 rounded-md border transition-all relative",
                  !deepSearch.canRun && "opacity-40 cursor-not-allowed",
                  deepSearch.status === "running" &&
                    "border-primary/30 bg-primary/10 text-primary",
                  deepSearch.status === "fresh" &&
                    "border-success/30 bg-success/10 text-success",
                  deepSearch.status === "stale" &&
                    "border-warning/30 bg-warning/10 text-warning",
                  (deepSearch.status === "missing" ||
                    deepSearch.status === "idle") &&
                    "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  deepSearch.status === "failed" &&
                    "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {deepSearch.status === "running" ? (
                  <Search className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
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
                    : deepSearch.status === "stale"
                      ? `Vecchia (${deepSearch.ageDays}gg) — clicca per ricompilare`
                      : deepSearch.status === "missing"
                        ? "Clicca per eseguire Deep Search"
                        : deepSearch.status === "failed"
                          ? "Errore — clicca per ritentare"
                          : "Deep Search"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
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
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <FileText className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                Template
              </TooltipContent>
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
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                Immagini
              </TooltipContent>
            </Tooltip>
          </div>

          {showTemplates && (
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-border/30 bg-muted/20">
              {templates.length === 0 ? (
                <p className="text-xs text-foreground/70 px-2 py-4 text-center">
                  Nessun template
                </p>
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

      <EmailTypeDetailDialog
        emailType={detailType}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
}
