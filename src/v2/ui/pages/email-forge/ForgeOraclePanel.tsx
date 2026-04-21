/**
 * ForgeOraclePanel — left panel of Email Forge.
 * Recipient picker (Partner/Contact/BCA) + tipo email + tono + KB + quality + goal.
 */
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import { ForgeRecipientPicker, type ForgeRecipient } from "./ForgeRecipientPicker";

export interface ForgeConfig {
  recipient: ForgeRecipient | null;
  emailType: EmailType | null;
  tone: string;
  useKB: boolean;
  customGoal: string;
  baseProposal: string;
  quality: "fast" | "standard" | "premium";
}

interface Props {
  initial?: Partial<ForgeConfig>;
  onRun: (config: ForgeConfig) => void;
  isLoading: boolean;
  /** Notifica al parent il destinatario corrente per il pannello "Cosa legge l'AI". */
  onRecipientChange?: (r: ForgeRecipient | null) => void;
  /** Notifica al parent le KB categories del tipo email selezionato. */
  onEmailTypeChange?: (t: EmailType | null) => void;
}

const DEFAULT_CONFIG: ForgeConfig = {
  recipient: null,
  emailType: DEFAULT_EMAIL_TYPES[0] ?? null,
  tone: "professionale",
  useKB: true,
  customGoal: "",
  baseProposal: "",
  quality: "standard",
};

export function ForgeOraclePanel({ initial, onRun, isLoading, onRecipientChange, onEmailTypeChange }: Props) {
  const [config, setConfig] = useState<ForgeConfig>({ ...DEFAULT_CONFIG, ...initial });

  const update = <K extends keyof ForgeConfig>(k: K, v: ForgeConfig[K]) =>
    setConfig((prev) => ({ ...prev, [k]: v }));

  const handleRecipient = (r: ForgeRecipient | null) => {
    update("recipient", r);
    onRecipientChange?.(r);
  };

  const handleEmailType = (t: EmailType) => {
    update("emailType", t);
    onEmailTypeChange?.(t);
  };

  const handleSubmit = () => {
    onRun(config);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 shrink-0 text-xs font-medium">
        <Sparkles className="w-3.5 h-3.5" />
        Oracolo · Configurazione
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Destinatario</div>
          <ForgeRecipientPicker value={config.recipient} onChange={handleRecipient} />
        </section>

        <section className="space-y-2 pt-2 border-t border-border/30">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo email</div>
          <div className="grid grid-cols-2 gap-1">
            {DEFAULT_EMAIL_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleEmailType(t)}
                className={`text-[11px] rounded border px-2 py-1.5 text-left transition-colors ${
                  config.emailType?.id === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 hover:border-border bg-card"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-border/30">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Tono</Label>
            <Select value={config.tone} onValueChange={(v) => update("tone", v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Quality (modello AI)</Label>
            <Select value={config.quality} onValueChange={(v) => update("quality", v as ForgeConfig["quality"])}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fast" className="text-xs">Fast (gemini-flash-lite)</SelectItem>
                <SelectItem value="standard" className="text-xs">Standard (gemini-3-flash)</SelectItem>
                <SelectItem value="premium" className="text-xs">Premium (gemini-3-flash + raw)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between py-1">
            <Label htmlFor="kb" className="text-[11px]">Usa Knowledge Base</Label>
            <Switch id="kb" checked={config.useKB} onCheckedChange={(v) => update("useKB", v)} />
          </div>
        </section>

        <section className="space-y-2 pt-2 border-t border-border/30">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Descrizione / obiettivo (opzionale)</Label>
            <Textarea
              value={config.customGoal}
              onChange={(e) => update("customGoal", e.target.value)}
              placeholder="Es. proporre uno scambio di traffico Italia→USA"
              className="min-h-[60px] text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Proposta base (opzionale)</Label>
            <Textarea
              value={config.baseProposal}
              onChange={(e) => update("baseProposal", e.target.value)}
              placeholder="Es. partnership reciproca, primi 3 spedizioni a tariffa scontata"
              className="min-h-[50px] text-xs"
            />
          </div>
        </section>
      </div>

      <div className="p-3 border-t border-border/60 shrink-0">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full"
          size="sm"
        >
          {isLoading ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generazione…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Genera + Ispeziona</>
          )}
        </Button>
      </div>
    </div>
  );
}
