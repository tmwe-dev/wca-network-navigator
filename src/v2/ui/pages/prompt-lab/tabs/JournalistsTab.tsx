/**
 * JournalistsTab — Configurazione "Caporedattore Finale" (LOVABLE-80 v2).
 * 4 giornalisti AI + toggle Optimus + modalità + rigore. Persiste in app_settings.
 */
import { useCallback, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Newspaper, Zap, Gavel, Handshake, Settings2, type LucideIcon } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Role = "rompighiaccio" | "risvegliatore" | "chiusore" | "accompagnatore";
type Field = "prompt" | "tone" | "rules" | "donts" | "kb_sources";

const JOURNALISTS: Array<{ role: Role; label: string; icon: LucideIcon; color: string; desc: string; states: string[] }> = [
  { role: "rompighiaccio", label: "Rompighiaccio", icon: Zap, color: "text-blue-500 bg-blue-500/10", desc: "Primo contatto. Apertura dialogo.", states: ["new", "first_touch_sent"] },
  { role: "risvegliatore", label: "Risvegliatore", icon: Newspaper, color: "text-amber-500 bg-amber-500/10", desc: "Dopo silenzio. Riattivazione.", states: ["holding", "archived"] },
  { role: "chiusore", label: "Chiusore", icon: Gavel, color: "text-destructive bg-destructive/10", desc: "Momento decisione. Chiusura.", states: ["qualified", "negotiation"] },
  { role: "accompagnatore", label: "Accompagnatore", icon: Handshake, color: "text-emerald-500 bg-emerald-500/10", desc: "Relazione attiva. Continuità.", states: ["converted"] },
];

const FIELD_LABELS: Record<Field, string> = {
  prompt: "Prompt",
  tone: "Tono",
  rules: "Regole",
  donts: "Cose da NON dire",
  kb_sources: "Fonti KB",
};

export function JournalistsTab() {
  const settings = useAppSettings();
  const updateSetting = useUpdateSetting();
  const data = settings.data ?? {};

  const enabled = data.journalist_optimus_enabled === "true";
  const mode = data.journalist_optimus_mode || "review_and_correct";
  const strictness = parseInt(data.journalist_optimus_strictness || "7", 10);

  const save = useCallback((key: string, value: string) => {
    updateSetting.mutate({ key, value }, {
      onSuccess: () => toast.success("Salvato"),
      onError: (e) => toast.error("Errore", { description: String(e) }),
    });
  }, [updateSetting]);

  return (
    <div className="space-y-3 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-2 p-2 border border-border/40 rounded bg-card">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Giornalisti AI — Caporedattore Finale
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={mode} onValueChange={(v) => save("journalist_optimus_mode", v)}>
            <SelectTrigger className="w-[170px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="review_and_correct">Rivedi e correggi</SelectItem>
              <SelectItem value="review_only">Solo revisione</SelectItem>
              <SelectItem value="silent_audit">Audit silenzioso</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Rigore {strictness}/10</span>
            <Slider className="w-24" value={[strictness]} onValueChange={([v]) => save("journalist_optimus_strictness", String(v))} min={1} max={10} step={1} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Optimus</span>
            <Switch checked={enabled} onCheckedChange={(v) => save("journalist_optimus_enabled", v ? "true" : "false")} />
          </div>
        </div>
      </div>

      <div className="p-2 rounded border border-border/30 bg-muted/30 text-[11px] space-y-1">
        <div><span className="text-emerald-500 font-medium">FA:</span> corregge tono/ritmo/CTA · adatta al giornalista attivo · segnala incoerenze brief↔testo · blocca promesse non verificabili.</div>
        <div><span className="text-destructive font-medium">NON FA:</span> non cambia strategia/stato/canale/playbook · non bypassa guardrail · non inventa informazioni.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {JOURNALISTS.map((j) => (
          <JournalistCard key={j.role} journalist={j} data={data} onSave={save} />
        ))}
      </div>

      <div className="p-2 rounded border border-purple-500/20 bg-purple-500/5 text-[11px] text-foreground/70">
        <span className="text-purple-500 font-medium">engaged</span> → auto-selezione contestuale: risposta positiva &lt;5gg → Accompagnatore | silenzio &gt;5gg → Risvegliatore. <span className="text-destructive font-medium">blacklisted</span> → blocco totale.
      </div>
    </div>
  );
}

function JournalistCard({ journalist: j, data, onSave }: {
  journalist: typeof JOURNALISTS[number];
  data: Record<string, string>;
  onSave: (key: string, value: string) => void;
}) {
  const Icon = j.icon;
  const [local, setLocal] = useState<Record<Field, string>>(() => ({
    prompt: data[`journalist_${j.role}_prompt`] || "",
    tone: data[`journalist_${j.role}_tone`] || "",
    rules: data[`journalist_${j.role}_rules`] || "",
    donts: data[`journalist_${j.role}_donts`] || "",
    kb_sources: data[`journalist_${j.role}_kb_sources`] || "",
  }));

  const blur = (field: Field) => () => {
    const key = `journalist_${j.role}_${field}`;
    if (local[field] !== (data[key] || "")) onSave(key, local[field]);
  };

  return (
    <div className="p-3 rounded border border-border/40 bg-card space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded", j.color)}><Icon className="h-3.5 w-3.5" /></div>
        <span className="font-semibold text-sm">{j.label}</span>
        <div className="flex gap-1 ml-auto flex-wrap">
          {j.states.map((s) => (
            <span key={s} className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[9px] font-mono">{s}</span>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{j.desc}</p>
      <details>
        <summary className="cursor-pointer text-xs text-primary/70">Configura (lascia vuoto per usare default)</summary>
        <div className="mt-2 space-y-2">
          {(Object.keys(FIELD_LABELS) as Field[]).map((field) => (
            <div key={field} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">{FIELD_LABELS[field]}</Label>
              {field === "tone" || field === "kb_sources" ? (
                <Input value={local[field]} onChange={(e) => setLocal({ ...local, [field]: e.target.value })} onBlur={blur(field)} className="h-7 text-xs" placeholder="(default)" />
              ) : (
                <Textarea value={local[field]} onChange={(e) => setLocal({ ...local, [field]: e.target.value })} onBlur={blur(field)} className="text-xs min-h-[60px]" placeholder="(default)" />
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}