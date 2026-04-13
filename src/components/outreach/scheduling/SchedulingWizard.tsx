/**
 * SchedulingWizard — Multi-step wizard to launch a cadence sequence
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, ChevronLeft, ChevronRight, Rocket, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import type { TimingTemplate } from "@/data/outreachTimingTemplates";
import { SequenceVisualizer } from "./SequenceVisualizer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TimingTemplate[];
}

type Source = "wca_partners" | "contacts" | "business_cards";

const STEP_LABELS = ["Sorgente", "Template", "Timing", "Riepilogo"];

export function SchedulingWizard({ open, onOpenChange, templates }: Props) {
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source>("wca_partners");
  const [onlyNoContact, setOnlyNoContact] = useState(true);
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TimingTemplate | null>(null);
  const [language, setLanguage] = useState("auto");
  const [startDate, setStartDate] = useState<Date>(addDays(new Date(), 1));
  const [batchSize, setBatchSize] = useState([20]);
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [launching, setLaunching] = useState(false);

  const filteredTemplates = templates.filter(
    (t) => t.source_type === source || t.source_type === "mixed"
  );

  const estimatedContacts = 0; // placeholder — actual count would come from a query
  const _estimatedDays = selectedTemplate
    ? Math.ceil(estimatedContacts / batchSize[0]) + (selectedTemplate.total_duration_days || 0)
    : 0;

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return selectedTemplate !== null;
    if (step === 2) return true;
    return true;
  };

  const handleLaunch = async () => {
    if (!selectedTemplate) return;
    setLaunching(true);
    try {
      // In production this would create outreach_mission + mission_actions
      toast.success("Programmazione avviata! Le azioni verranno create progressivamente.");
      onOpenChange(false);
      setStep(0);
    } catch {
      toast.error("Errore avvio programmazione");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            Avvia Programmazione
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-2">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium",
                  i === step ? "bg-primary text-primary-foreground" :
                  i < step ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"
                )}>{i + 1}</div>
                <span className={cn("text-[10px]", i === step ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
                {i < 3 && <div className="w-4 h-px bg-border/50" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2 -mr-2">
          <div className="space-y-4 py-2">
            {/* Step 0: Source */}
            {step === 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-medium">Seleziona Sorgente Contatti</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["wca_partners", "contacts", "business_cards"] as Source[]).map((s) => (
                    <button key={s} onClick={() => setSource(s)}
                      className={cn("p-3 rounded-lg border text-center transition-all", source === s ? "border-primary bg-primary/5" : "border-border/30 hover:bg-muted/30")}>
                      <Users className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                      <span className="text-xs font-medium block">
                        {s === "wca_partners" ? "Partner WCA" : s === "contacts" ? "Contatti CRM" : "Biglietti Visita"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={onlyNoContact} onCheckedChange={setOnlyNoContact} />
                    Solo mai contattati
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={onlyWithEmail} onCheckedChange={setOnlyWithEmail} />
                    Solo con email
                  </label>
                </div>
              </div>
            )}

            {/* Step 1: Template */}
            {step === 1 && (
              <div className="space-y-3">
                <Label className="text-xs font-medium">Seleziona Template</Label>
                <div className="grid grid-cols-2 gap-2">
                  {filteredTemplates.map((tpl) => (
                    <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all",
                        selectedTemplate?.id === tpl.id ? "border-primary bg-primary/5" : "border-border/30 hover:bg-muted/30"
                      )}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium truncate">{tpl.template_name}</span>
                        {tpl.is_system && <Badge className="text-[7px] h-3.5 px-1 bg-muted text-muted-foreground">Sistema</Badge>}
                      </div>
                      <SequenceVisualizer steps={tpl.sequence} compact />
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {tpl.sequence.length} step · {tpl.total_duration_days} giorni
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Timing */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Lingua</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (lingua destinatario)</SelectItem>
                      <SelectItem value="en">Inglese per tutti</SelectItem>
                      <SelectItem value="it">Italiano per tutti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium">Data Inizio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-8 text-xs mt-1 justify-start">
                        <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                        {format(startDate, "dd MMMM yyyy", { locale: it })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate}
                        onSelect={(d) => d && setStartDate(d)}
                        disabled={(d) => d < new Date()}
                        className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-xs font-medium">Contatti per Giorno: {batchSize[0]}</Label>
                  <Slider value={batchSize} onValueChange={setBatchSize} min={5} max={50} step={5} className="mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">Quanti contatti iniziano la sequenza ogni giorno</p>
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={excludeWeekends} onCheckedChange={setExcludeWeekends} />
                  Escludi weekend
                </label>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && selectedTemplate && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{selectedTemplate.template_name}</span>
                    <Badge variant="outline" className="text-[10px]">{selectedTemplate.goal}</Badge>
                  </div>
                  <SequenceVisualizer steps={selectedTemplate.sequence} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-card/50 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Sorgente</p>
                    <p className="text-xs font-medium">{source === "wca_partners" ? "Partner WCA" : source === "contacts" ? "Contatti CRM" : "Biglietti Visita"}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/50 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Lingua</p>
                    <p className="text-xs font-medium">{language === "auto" ? "Auto" : language === "en" ? "Inglese" : "Italiano"}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/50 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Inizio</p>
                    <p className="text-xs font-medium">{format(startDate, "dd MMM yyyy", { locale: it })}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/50 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Batch/Giorno</p>
                    <p className="text-xs font-medium">{batchSize[0]} contatti</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <Clock className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs font-medium">Durata sequenza: {selectedTemplate.total_duration_days} giorni</p>
                    <p className="text-[10px] text-muted-foreground">{selectedTemplate.sequence.length} touchpoint · {excludeWeekends ? "esclusi weekend" : "inclusi weekend"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} className="gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Indietro
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
            {step < 3 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="gap-1">
                Avanti <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button onClick={handleLaunch} disabled={launching} className="gap-1.5">
                <Rocket className="w-3.5 h-3.5" />
                {launching ? "Avvio..." : "Avvia Programmazione"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
