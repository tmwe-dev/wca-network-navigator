import { useState, useMemo, useCallback } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Loader2, Sparkles, Wand2, Plus, BookOpen, X, ExternalLink, Info, Mic, MicOff, Search, SlidersHorizontal, FileText, ImageIcon, Handshake, RefreshCw, ClipboardList, Briefcase, Globe, Plane, GraduationCap, Smile, Target } from "lucide-react";
import albertTalkGif from "@/assets/albert-talk.gif";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Handshake, RefreshCw, ClipboardList, Briefcase, Globe, Plane, GraduationCap, Smile, Target,
};
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import EmailTypeDetailDialog from "./EmailTypeDetailDialog";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { ImageGalleryTab } from "./ImageGalleryTab";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

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
}

/** Abbreviated chip labels for default types */
const CHIP_LABELS: Record<string, string> = {
  primo_contatto: "Primo",
  follow_up: "Follow",
  richiesta_info: "Info",
  proposta: "Proposta",
  partnership: "Partner",
  network_espresso: "Express",
};

export default function OraclePanel({ onGenerate, onImprove, onLoadTemplate, onInsertImage, generating, improving, hasBody }: OraclePanelProps) {
  const navigate = useAppNavigate();
  const [selectedType, setSelectedType] = useState<EmailType | null>(null);
  const [tone, setTone] = useState("professionale");
  const [useKB, setUseKB] = useState(true);
  const [deepSearch, setDeepSearch] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📧");
  const [newPrompt, setNewPrompt] = useState("");
  const [detailType, setDetailType] = useState<EmailType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [customGoal, setCustomGoal] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImages, setShowImages] = useState(false);

  // Voice dictation
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
    } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return []; }
  }, [settings?.email_oracle_types]);

  const allTypes = useMemo(() => [...DEFAULT_EMAIL_TYPES, ...customTypes], [customTypes]);

  const config: OracleConfig = { emailType: selectedType, tone, useKB, deepSearch, customGoal: customGoal.trim() };

  const handleAddType = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const newType: EmailType = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      icon: newIcon || "📧",
      category: "altro",
      prompt: newPrompt.trim(),
      tone,
    };
    const updated = [...customTypes, newType];
    updateSetting.mutate({ key: "email_oracle_types", value: JSON.stringify(updated) });
    setSelectedType(newType);
    setNewName(""); setNewIcon("📧"); setNewPrompt("");
    setShowNewType(false);
  };

  const removeCustomType = (id: string) => {
    const updated = customTypes.filter(t => t.id !== id);
    updateSetting.mutate({ key: "email_oracle_types", value: JSON.stringify(updated) });
    if (selectedType?.id === id) setSelectedType(null);
  };

  const handleDuplicate = (newType: EmailType) => {
    const updated = [...customTypes, newType];
    updateSetting.mutate({ key: "email_oracle_types", value: JSON.stringify(updated) });
    setSelectedType(newType);
  };

  const openDetail = (t: EmailType) => {
    setDetailType(t);
    setDetailOpen(true);
  };

  const currentToneOption = TONE_OPTIONS.find(t => t.value === tone);

  return (
    <div className="flex flex-col h-full border-l border-border/30 bg-muted/5">
      {/* Header */}
      <div className="shrink-0 px-3 py-3 border-b border-border/30 flex flex-col items-center gap-1.5">
        <div className="shrink-0 w-[100px] h-[100px]">
          <OptimizedImage src={albertTalkGif} alt="Oracolo" className="w-full h-full object-contain rounded-xl" />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase text-foreground/80">Oracolo</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-3">
        {/* === TEXTAREA PROMINENTE === */}
        <div className="relative">
          <Textarea
            value={speech.listening ? (customGoal + (speech.interimText ? " " + speech.interimText : "")) : customGoal}
            onChange={(e) => setCustomGoal(e.target.value)}
            placeholder="Descrivi l'obiettivo della email..."
            className={cn(
              "text-xs min-h-[160px] max-h-[240px] resize-none pr-8",
              speech.listening && "ring-1 ring-red-400/50"
            )}
            rows={6}
          />
          {speech.hasSpeechAPI && (
            <button
              type="button"
              onClick={speech.toggle}
              className={cn(
                "absolute right-1.5 top-1.5 p-1 rounded-full transition-colors",
                speech.listening
                  ? "bg-red-500/10 text-red-500 animate-pulse"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              title={speech.listening ? "Ferma registrazione" : "Dettatura vocale"}
            >
              {speech.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* === TIPO EMAIL — CHIP ROW === */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {allTypes.map((t) => {
            const isSelected = selectedType?.id === t.id;
            const isCustom = customTypes.some(c => c.id === t.id);
            const chipLabel = CHIP_LABELS[t.id] || t.name;
            return (
              <div key={t.id} className="flex items-center shrink-0">
                <button
                  onClick={() => setSelectedType(isSelected ? null : t)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border whitespace-nowrap transition-all",
                    isSelected
                      ? "bg-primary/15 ring-1 ring-primary/30 border-primary/30 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {ICON_MAP[t.icon] ? (() => { const Icon = ICON_MAP[t.icon]; return <Icon className="w-3.5 h-3.5 text-current" />; })() : <span className="text-xs">{t.icon}</span>}
                  <span>{chipLabel}</span>
                  {isCustom && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); removeCustomType(t.id); }}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
                {isSelected && (
                  <button
                    onClick={() => openDetail(t)}
                    className="shrink-0 p-0.5 ml-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="Dettaglio tipo"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          {/* Add chip */}
          <button
            onClick={() => setShowNewType(!showNewType)}
            className={cn(
              "shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] border transition-colors",
              showNewType
                ? "border-primary/30 text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Inline new type form */}
        {showNewType && (
          <div className="p-2 rounded-lg bg-muted/30 space-y-1.5 border border-border/30">
            <div className="flex gap-1.5">
              <Input value={newIcon} onChange={e => setNewIcon(e.target.value)} className="w-10 h-7 text-center text-sm px-1" maxLength={2} />
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome tipo" className="flex-1 h-7 text-xs" />
            </div>
            <Textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder="Prompt / obiettivo..." className="text-xs min-h-[60px] resize-none" rows={3} />
            <div className="flex gap-1">
              <Button size="sm" variant="default" className="h-6 text-[10px] flex-1" onClick={handleAddType}>Salva</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowNewType(false)}>Annulla</Button>
            </div>
          </div>
        )}

        {/* === CONFIG RAPIDA — UNA RIGA === */}
        <div className="flex items-center gap-2 px-1 py-1">
          {/* Tone icon → Select */}
          <div title={"Tono: " + (currentToneOption?.label || "Professionale")}>
          <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-7 w-9 p-0 border-0 bg-transparent justify-center [&>svg:last-child]:hidden">
                  <SlidersHorizontal className="w-4 h-4 text-foreground/70" />
                </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {ICON_MAP[t.icon] ? (() => { const Icon = ICON_MAP[t.icon]; return <><Icon className="w-3.5 h-3.5 inline-block mr-1 text-current" />{t.label}</>; })() : <>{t.icon} {t.label}</>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>

          {/* KB toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setUseKB(!useKB)}
                className={cn(
                  "p-1.5 rounded-md border transition-all",
                  useKB ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground/40 hover:border-primary/30 hover:text-foreground"
                )}
              >
                <BookOpen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">
              Knowledge Base: {useKB ? "attiva" : "spenta"}
            </TooltipContent>
          </Tooltip>

          {/* Deep Search toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setDeepSearch(!deepSearch)}
                className={cn(
                  "p-1.5 rounded-md border transition-all",
                  deepSearch ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground/40 hover:border-primary/30 hover:text-foreground"
                )}
              >
                <Search className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">
              Deep Search: {deepSearch ? "attivo" : "spento"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* === TEMPLATE & IMMAGINI — INLINE COLLAPSIBLES === */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setShowTemplates(!showTemplates); if (!showTemplates) setShowImages(false); }}
                  className={cn(
                    "p-1.5 rounded-md border transition-all",
                    showTemplates ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <FileText className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Template</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setShowImages(!showImages); if (!showImages) setShowTemplates(false); }}
                  className={cn(
                    "p-1.5 rounded-md border transition-all",
                    showImages ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Immagini</TooltipContent>
            </Tooltip>
          </div>

          {/* Templates inline */}
          {showTemplates && (
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-border/30 bg-muted/20">
              {templates.length === 0 ? (
                <p className="text-[10px] text-muted-foreground px-2 py-4 text-center">Nessun template</p>
              ) : (
                <div className="p-1 space-y-0.5">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { onLoadTemplate(t.name || "", t.file_url || ""); setShowTemplates(false); }}
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

          {/* Images inline */}
          {showImages && (
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-border/30">
              <ImageGalleryTab onInsertImage={onInsertImage || (() => {})} />
            </div>
          )}
        </div>
      </div>

      {/* === KB LINK + ACTION BUTTONS (pinned bottom) === */}
      <div className="shrink-0 border-t border-border/30 px-3 py-2.5 space-y-2">
        <button
          onClick={() => navigate("/settings?tab=ai-prompt")}
          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
        >
          <BookOpen className="w-3 h-3" /> Gestisci KB & Prompt
          <ExternalLink className="w-2.5 h-2.5" />
        </button>

        <Button
          size="sm"
          className="w-full h-10 text-xs gap-1.5"
          onClick={() => onGenerate(config)}
          disabled={generating || improving}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? "Generazione..." : "Genera"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => onImprove(config)}
          disabled={improving || generating || !hasBody}
        >
          {improving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-amber-500" />}
          {improving ? "Miglioramento..." : "Migliora"}
        </Button>
      </div>

      <EmailTypeDetailDialog
        emailType={detailType}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
}
