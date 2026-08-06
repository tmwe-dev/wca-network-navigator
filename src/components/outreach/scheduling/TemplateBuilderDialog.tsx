/**
 * TemplateBuilderDialog — Create/edit cadence templates
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, GripVertical, Mail, MessageCircle, Linkedin, Phone } from "lucide-react";
import { toast } from "sonner";
import { createTimingTemplate, type TimingStep } from "@/data/outreachTimingTemplates";
import { SequenceVisualizer } from "./SequenceVisualizer";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "phone", label: "Telefono", icon: Phone },
];

const TRIGGERS = [
  { value: "immediate", label: "Immediato" },
  { value: "no_response", label: "Nessuna risposta" },
  { value: "negative_response", label: "Risposta negativa" },
  { value: "positive_response", label: "Risposta positiva" },
];

const TONES = [
  { value: "professional", label: "Professionale" },
  { value: "casual_followup", label: "Casual follow-up" },
  { value: "friendly", label: "Amichevole" },
  { value: "formal", label: "Formale" },
  { value: "value_proposition", label: "Proposta valore" },
  { value: "connection_request", label: "Richiesta connessione" },
  { value: "call_script", label: "Script chiamata" },
];

const SOURCE_TYPES = [
  { value: "wca_partners", label: "Partner WCA" },
  { value: "contacts", label: "Contatti" },
  { value: "business_cards", label: "Biglietti da Visita" },
  { value: "mixed", label: "Misto" },
];

const GOALS = [
  { value: "primo_contatto", label: "Primo Contatto" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "nurturing", label: "Nurturing" },
  { value: "reactivation", label: "Riattivazione" },
  { value: "event_followup", label: "Follow-Up Evento" },
  { value: "partnership_proposal", label: "Proposta Partnership" },
  { value: "info_request", label: "Richiesta Info" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyStep = (n: number): TimingStep => ({
  step: n, channel: "email", delay_days: n === 1 ? 0 : 3,
  trigger: n === 1 ? "immediate" : "no_response",
  tone: "professional", template_hint: "",
});

export function TemplateBuilderDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("wca_partners");
  const [goal, setGoal] = useState("primo_contatto");
  const [steps, setSteps] = useState<TimingStep[]>([emptyStep(1)]);
  const [saving, setSaving] = useState(false);

  const addStep = () => setSteps((s) => [...s, emptyStep(s.length + 1)]);

  const removeStep = (idx: number) => {
    setSteps((s) => s.filter((_, i) => i !== idx).map((st, i) => ({ ...st, step: i + 1 })));
  };

  const updateStep = (idx: number, updates: Partial<TimingStep>) => {
    setSteps((s) => s.map((st, i) => i === idx ? { ...st, ...updates } : st));
  };

  const totalDays = steps.reduce((acc, s) => acc + s.delay_days, 0);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Inserisci un nome"); return; }
    if (steps.length === 0) { toast.error("Aggiungi almeno uno step"); return; }
    setSaving(true);
    try {
      await createTimingTemplate({
        user_id: null, template_name: name, description: null,
        is_system: false, source_type: sourceType, goal,
        sequence: steps, max_attempts: steps.length,
        total_duration_days: totalDays,
        preferred_language: "auto", auto_translate: true,
      });
      qc.invalidateQueries({ queryKey: queryKeys.timingTemplates.all });
      toast.success("Template creato!");
      onOpenChange(false);
      setName(""); setSteps([emptyStep(1)]);
    } catch { toast.error("Errore creazione"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Crea Template di Programmazione</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-4 pb-4">
            {/* Basic info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <Label className="text-xs">Nome Template</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Follow-Up Fiera Milano" className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Sorgente</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Obiettivo</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Badge variant="outline" className="text-[10px] h-5">{steps.length} step · {totalDays} giorni</Badge>
              </div>
            </div>

            {/* Preview */}
            {steps.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <p className="text-[10px] text-muted-foreground mb-2">Anteprima Sequenza</p>
                <SequenceVisualizer steps={steps} />
              </div>
            )}

            {/* Step editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Sequenza Steps</Label>
                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={addStep}>
                  <Plus className="w-3 h-3" /> Aggiungi Step
                </Button>
              </div>

              {steps.map((step, idx) => (
                <div key={idx} className="grid grid-cols-[auto_1fr_80px_1fr_1fr_1fr_auto] gap-1.5 items-center p-2 rounded-lg bg-card/40 border border-border/20">
                  <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />

                  <Select value={step.channel} onValueChange={(v) => updateStep(idx, { channel: v })}>
                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">+</span>
                    <Input type="number" min={0} value={step.delay_days} onChange={(e) => updateStep(idx, { delay_days: parseInt(e.target.value) || 0 })} className="h-7 text-[10px] w-full" />
                    <span className="text-[9px] text-muted-foreground">g</span>
                  </div>

                  <Select value={step.trigger} onValueChange={(v) => updateStep(idx, { trigger: v })}>
                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>

                  <Select value={step.tone} onValueChange={(v) => updateStep(idx, { tone: v })}>
                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>

                  <Input value={step.template_hint} onChange={(e) => updateStep(idx, { template_hint: e.target.value })} placeholder="Hint..." className="h-7 text-[10px]" />

                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeStep(idx)} disabled={steps.length <= 1}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvataggio..." : "Salva Template"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
