import { useState, useEffect } from "react";
import { Save, Loader2, BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("OperativeGuideSettings");

interface OperativeRule {
  id: string;
  label: string;
  value: string;
}

interface OperativeStrategy {
  dailyContactLimit: number;
  preferredChannels: string[];
  followUpDays: number;
  escalationDays: number;
  ethicalRules: string;
  toneOfVoice: string;
  supervisorEnabled: boolean;
  supervisorAgentName: string;
  dataSources: string;
  messageMaxLines: number;
  customRules: OperativeRule[];
}

const DEFAULT_STRATEGY: OperativeStrategy = {
  dailyContactLimit: 20,
  preferredChannels: ["email", "whatsapp", "linkedin"],
  followUpDays: 5,
  escalationDays: 7,
  ethicalRules: "Non inviare più di 2 messaggi a settimana per contatto.\nRispettare gli orari lavorativi (9-18).\nNon contattare chi ha richiesto di non essere disturbato.",
  toneOfVoice: "Professionale ma amichevole, come tra colleghi del settore. Evitare toni troppo formali o freddi.",
  supervisorEnabled: true,
  supervisorAgentName: "Gigi",
  dataSources: "Partner WCA, Contatti CRM importati, Biglietti da visita, Directory network",
  messageMaxLines: 6,
  customRules: [],
};

const CHANNEL_OPTIONS = [
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "phone", label: "Telefono" },
];

export default function OperativeGuideSettings() {
  const [strategy, setStrategy] = useState<OperativeStrategy>(DEFAULT_STRATEGY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "operative_strategy")
        .maybeSingle();
      if (data?.value) {
        try {
          setStrategy({ ...DEFAULT_STRATEGY, ...JSON.parse(data.value) });
        } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); }
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "operative_strategy", value: JSON.stringify(strategy), updated_at: new Date().toISOString(), user_id: user.id }, { onConflict: "user_id,key" });
      if (error) throw error;
      toast.success("Guida Operativa salvata");
    } catch (e: any) {
      toast.error(e.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setStrategy(s => ({
      ...s,
      preferredChannels: s.preferredChannels.includes(ch)
        ? s.preferredChannels.filter(c => c !== ch)
        : [...s.preferredChannels, ch],
    }));
  };

  const addCustomRule = () => {
    setStrategy(s => ({
      ...s,
      customRules: [...s.customRules, { id: crypto.randomUUID(), label: "", value: "" }],
    }));
  };

  const removeCustomRule = (id: string) => {
    setStrategy(s => ({ ...s, customRules: s.customRules.filter(r => r.id !== id) }));
  };

  const updateCustomRule = (id: string, field: "label" | "value", val: string) => {
    setStrategy(s => ({
      ...s,
      customRules: s.customRules.map(r => r.id === id ? { ...r, [field]: val } : r),
    }));
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Guida Operativa</h2>
        </div>
        <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salva
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Definisci le regole operative che il Supervisor AI e tutti gli agenti seguono. Queste regole guidano la generazione dei messaggi, il timing dei follow-up e la qualità delle comunicazioni.
      </p>

      {/* Supervisor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Supervisor AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Attiva revisione Supervisor</Label>
            <Switch checked={strategy.supervisorEnabled} onCheckedChange={v => setStrategy(s => ({ ...s, supervisorEnabled: v }))} />
          </div>
          <div>
            <Label>Nome agente Supervisor</Label>
            <Input value={strategy.supervisorAgentName} onChange={e => setStrategy(s => ({ ...s, supervisorAgentName: e.target.value }))} placeholder="Gigi" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Limiti e Timing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Limiti e Timing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Contatti/giorno max</Label>
            <Input type="number" value={strategy.dailyContactLimit} onChange={e => setStrategy(s => ({ ...s, dailyContactLimit: +e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Max righe messaggio</Label>
            <Input type="number" value={strategy.messageMaxLines} onChange={e => setStrategy(s => ({ ...s, messageMaxLines: +e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Follow-up dopo (giorni)</Label>
            <Input type="number" value={strategy.followUpDays} onChange={e => setStrategy(s => ({ ...s, followUpDays: +e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Escalation dopo (giorni)</Label>
            <Input type="number" value={strategy.escalationDays} onChange={e => setStrategy(s => ({ ...s, escalationDays: +e.target.value }))} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Canali */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Canali preferiti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map(ch => (
              <Button
                key={ch.id}
                variant={strategy.preferredChannels.includes(ch.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleChannel(ch.id)}
              >
                {ch.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fonti dati */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Fonti dati</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={strategy.dataSources} onChange={e => setStrategy(s => ({ ...s, dataSources: e.target.value }))} rows={3} placeholder="Da dove prendere i contatti…" />
        </CardContent>
      </Card>

      {/* Tono */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Tono di voce</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={strategy.toneOfVoice} onChange={e => setStrategy(s => ({ ...s, toneOfVoice: e.target.value }))} rows={3} />
        </CardContent>
      </Card>

      {/* Regole etiche */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Regole etiche</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={strategy.ethicalRules} onChange={e => setStrategy(s => ({ ...s, ethicalRules: e.target.value }))} rows={4} />
        </CardContent>
      </Card>

      {/* Regole personalizzate */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Regole personalizzate</CardTitle>
            <Button variant="ghost" size="sm" onClick={addCustomRule} className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" /> Aggiungi
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {strategy.customRules.length === 0 && (
            <p className="text-xs text-muted-foreground">Nessuna regola personalizzata. Clicca "Aggiungi" per crearne una.</p>
          )}
          {strategy.customRules.map(rule => (
            <div key={rule.id} className="flex gap-2 items-start">
              <Input value={rule.label} onChange={e => updateCustomRule(rule.id, "label", e.target.value)} placeholder="Nome regola" className="w-1/3" />
              <Input value={rule.value} onChange={e => updateCustomRule(rule.id, "value", e.target.value)} placeholder="Valore / descrizione" className="flex-1" />
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() = aria-label="Elimina"> removeCustomRule(rule.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
