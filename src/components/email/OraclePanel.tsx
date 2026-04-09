import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Wand2, Plus, BookOpen, X, ExternalLink, Info, ImageIcon, Mic, MicOff } from "lucide-react";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import EmailTypeDetailDialog from "./EmailTypeDetailDialog";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { useEmailTemplates } from "@/hooks/useCampaignJobs";
import { ImageGalleryTab } from "./ImageGalleryTab";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { cn } from "@/lib/utils";

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

export default function OraclePanel({ onGenerate, onImprove, onLoadTemplate, onInsertImage, generating, improving, hasBody }: OraclePanelProps) {
  const navigate = useNavigate();
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

  // Voice dictation for custom goal
  const onVoiceText = useCallback((text: string) => {
    setCustomGoal(text);
  }, []);
  const speech = useContinuousSpeech(onVoiceText);

  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const { data: templates = [] } = useEmailTemplates();

  // Custom types from app_settings
  const customTypes: EmailType[] = useMemo(() => {
    try {
      return JSON.parse(settings?.email_oracle_types || "[]");
    } catch { return []; }
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

  const salesKB = settings?.ai_sales_knowledge_base || "";
  const companyKB = settings?.ai_knowledge_base || "";

  return (
    <div className="flex flex-col h-full border-l border-border/30 bg-muted/5">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border/30 flex items-center gap-2">
        <span className="text-base">🔮</span>
        <span className="text-xs font-semibold tracking-wide uppercase text-foreground/80">Oracolo</span>
      </div>

      <Tabs defaultValue="tipi" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 mx-2 mt-2 h-7 p-0.5">
          <TabsTrigger value="tipi" className="text-[10px] h-6 px-2">Tipi</TabsTrigger>
          <TabsTrigger value="template" className="text-[10px] h-6 px-2">Template</TabsTrigger>
          <TabsTrigger value="immagini" className="text-[10px] h-6 px-2 gap-0.5">
            <ImageIcon className="w-2.5 h-2.5" />
            Img
          </TabsTrigger>
        </TabsList>

        {/* === TIPI TAB === */}
        <TabsContent value="tipi" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=active]:flex">
          {/* Custom Goal field with voice dictation */}
          <div className="px-2 pt-2 pb-1 shrink-0">
            <div className="relative">
              <Textarea
                value={speech.listening ? (customGoal + (speech.interimText ? " " + speech.interimText : "")) : customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Descrivi l'obiettivo o il contesto... (es: ci siamo incontrati a Genova, parlato di pezzi di ricambio)"
                className={cn(
                  "text-[11px] min-h-[56px] max-h-[100px] resize-none pr-8",
                  speech.listening && "ring-1 ring-red-400/50"
                )}
                rows={2}
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
          </div>

          <ScrollArea className="h-0 flex-1 px-2 py-1.5">
            <div className="space-y-1">
              {allTypes.map((t) => {
                const isCustom = customTypes.some(c => c.id === t.id);
                return (
                  <div key={t.id} className="flex items-center gap-0.5 group">
                    <button
                      onClick={() => setSelectedType(selectedType?.id === t.id ? null : t)}
                      className={cn(
                        "flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all text-xs",
                        selectedType?.id === t.id
                          ? "bg-primary/10 ring-1 ring-primary/30 text-primary font-medium"
                          : "hover:bg-muted/50 text-foreground/70"
                      )}
                    >
                      <span className="text-sm shrink-0">{t.icon}</span>
                      <span className="truncate flex-1">{t.name}</span>
                    </button>
                    <button
                      onClick={() => openDetail(t)}
                      className="shrink-0 p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                      title="Dettaglio"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => removeCustomType(t.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity"
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add new type */}
              {!showNewType ? (
                <button
                  onClick={() => setShowNewType(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crea tipo...</span>
                </button>
              ) : (
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
            </div>
          </ScrollArea>
        </TabsContent>

        {/* === TEMPLATE TAB === */}
        <TabsContent value="template" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=active]:flex">
          <ScrollArea className="flex-1 px-2 py-1.5">
            {templates.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-2 py-4 text-center">Nessun template disponibile</p>
            ) : (
              <div className="space-y-1">
                {templates.map((t: any) => (
                  <Tooltip key={t.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onLoadTemplate(t.name || "", t.file_url || "")}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs hover:bg-muted/50 text-foreground/70 transition-colors"
                      >
                        <span className="text-sm shrink-0">📄</span>
                        <span className="truncate flex-1">{t.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[220px] text-[11px]">
                      {t.file_name} · {t.category || "altro"}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* === IMMAGINI TAB === */}
        <TabsContent value="immagini" className="flex-1 min-h-0 flex flex-col mt-0">
          <ImageGalleryTab onInsertImage={onInsertImage || (() => {})} />
        </TabsContent>
      </Tabs>

      {/* === AI OPTIONS — always visible at bottom === */}
      <div className="shrink-0 border-t border-border/30 px-3 py-2 space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Opzioni AI</p>

        {/* Deep Search */}
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-[11px] text-foreground/70">🔍 Deep Search live</span>
          <Switch checked={deepSearch} onCheckedChange={setDeepSearch} className="scale-75" />
        </label>

        {/* KB toggle */}
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-[11px] text-foreground/70">📚 Knowledge Base</span>
          <Switch checked={useKB} onCheckedChange={setUseKB} className="scale-75" />
        </label>

        {/* Tone */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-foreground/70 shrink-0">Tono:</span>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="h-6 text-[11px] flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.icon} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KB manager link — navigates to Settings */}
        <button
          onClick={() => navigate("/settings?tab=ai-prompt")}
          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
        >
          <BookOpen className="w-3 h-3" /> Gestisci KB & Prompt
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* === ACTION BUTTONS === */}
      <div className="shrink-0 border-t border-border/30 px-3 py-2.5 space-y-1.5">
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => onGenerate(config)}
          disabled={generating || improving}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? "Generazione..." : "🔮 Genera con Oracolo"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => onImprove(config)}
          disabled={improving || generating || !hasBody}
        >
          {improving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-amber-500" />}
          {improving ? "Miglioramento..." : "🪄 Migliora"}
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
