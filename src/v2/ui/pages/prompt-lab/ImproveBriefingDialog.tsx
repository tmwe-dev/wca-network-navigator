/**
 * ImproveBriefingDialog — checklist guidata pre-generazione.
 *
 * Raccoglie da operatore:
 *   - obiettivo (cosa deve ottenere il blocco)
 *   - contesto d'uso (quando/dove viene attivato)
 *   - target (canale, tipo agente, audience)
 *   - vincoli (CTA richiesta, lingua, lunghezza, must-not)
 *
 * Restituisce un BriefingPayload che useLabAgent inietta come "Briefing operativo"
 * prioritario nel prompt di miglioramento. Garantisce che il modello generi solo
 * contenuti coerenti con lo scopo dichiarato (no derive generaliste).
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import type { BriefingPayload } from "./hooks/useLabAgent";
import type { Block } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  block: Block | null;
  tabLabel: string;
  /** Hint sul tipo di blocco rilevato (voice / email / system / kb / playbook). */
  detectedKind?: string;
  onConfirm: (briefing: BriefingPayload) => void | Promise<void>;
  loading?: boolean;
}

const TARGET_CHANNELS = [
  { value: "voice_agent", label: "Agente vocale (ElevenLabs)" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "internal_ai", label: "AI interna (Director / Cockpit)" },
  { value: "kb_governance", label: "Knowledge Base / dottrina" },
  { value: "multi_channel", label: "Multi-canale" },
] as const;

const AUDIENCES = [
  { value: "cold_lead", label: "Lead freddo (primo contatto)" },
  { value: "warm_lead", label: "Lead caldo (in conversazione)" },
  { value: "holding_pattern", label: "Lead in holding pattern" },
  { value: "existing_partner", label: "Partner esistente" },
  { value: "internal_team", label: "Team interno / staff" },
  { value: "system_actor", label: "Attore di sistema (agente AI)" },
] as const;

const LANGUAGES = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "Inglese" },
  { value: "auto", label: "Auto (mantieni originale)" },
] as const;

const CTA_TYPES = [
  { value: "none", label: "Nessuna CTA (informativo)" },
  { value: "meeting", label: "Fissare un meeting" },
  { value: "reply", label: "Ottenere una risposta" },
  { value: "info", label: "Richiedere info specifiche" },
  { value: "qualify", label: "Qualificare il lead" },
  { value: "close", label: "Chiusura / decisione" },
] as const;

function defaultBriefing(detectedKind?: string): BriefingPayload {
  const isVoice = detectedKind === "voice";
  return {
    goal: "",
    contextOfUse: "",
    targetChannel: isVoice ? "voice_agent" : "",
    audience: "",
    language: "auto",
    ctaType: isVoice ? "qualify" : "",
    mustHave: "",
    mustNotHave: "",
    extraConstraints: "",
  };
}

export function ImproveBriefingDialog({
  open,
  onOpenChange,
  block,
  tabLabel,
  detectedKind,
  onConfirm,
  loading,
}: Props) {
  const [data, setData] = useState<BriefingPayload>(() => defaultBriefing(detectedKind));

  // Reset quando cambia blocco / si apre
  useEffect(() => {
    if (open) setData(defaultBriefing(detectedKind));
  }, [open, detectedKind, block?.id]);

  const update = <K extends keyof BriefingPayload>(k: K, v: BriefingPayload[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const canConfirm = data.goal.trim().length >= 10 && data.targetChannel.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Briefing pre-miglioramento
          </DialogTitle>
          <DialogDescription>
            Compila la checklist: l'AI userà queste info come <strong>guard-rail prioritari</strong> per generare
            solo contenuti coerenti con lo scopo dichiarato.
            {block && (
              <span className="block mt-1 text-xs">
                Blocco: <code className="text-foreground">{block.label}</code> · Tab:{" "}
                <code className="text-foreground">{tabLabel}</code>
                {detectedKind && (
                  <>
                    {" "}· Tipo rilevato:{" "}
                    <code className="text-foreground">{detectedKind}</code>
                  </>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* OBIETTIVO */}
          <div className="space-y-1">
            <Label htmlFor="goal" className="text-xs font-semibold">
              1. Obiettivo concreto <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="goal"
              value={data.goal}
              onChange={(e) => update("goal", e.target.value)}
              placeholder='Es: "ottenere risposta da freight forwarder italiani in holding pattern da 7+ giorni"'
              rows={2}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Cosa deve <em>ottenere</em> questo blocco quando viene eseguito? (min 10 caratteri)
            </p>
          </div>

          {/* CONTESTO D'USO */}
          <div className="space-y-1">
            <Label htmlFor="context" className="text-xs font-semibold">
              2. Contesto d'uso runtime
            </Label>
            <Textarea
              id="context"
              value={data.contextOfUse}
              onChange={(e) => update("contextOfUse", e.target.value)}
              placeholder='Es: "viene chiamato dall agente vocale durante chiamate outbound a freddo, dopo che il contatto ha risposto"'
              rows={2}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Quando e in quale punto del flusso viene attivato? (opzionale, default: deduzione da tab)
            </p>
          </div>

          {/* TARGET CHANNEL + AUDIENCE */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                3. Canale target <span className="text-destructive">*</span>
              </Label>
              <Select value={data.targetChannel} onValueChange={(v) => update("targetChannel", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleziona canale" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">4. Audience</Label>
              <Select value={data.audience} onValueChange={(v) => update("audience", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="A chi si rivolge?" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value} className="text-xs">
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* LINGUA + CTA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">5. Lingua output</Label>
              <Select value={data.language} onValueChange={(v) => update("language", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value} className="text-xs">
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">6. Tipo CTA atteso</Label>
              <Select value={data.ctaType} onValueChange={(v) => update("ctaType", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Quale azione vuoi?" />
                </SelectTrigger>
                <SelectContent>
                  {CTA_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* MUST HAVE / MUST NOT */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="must" className="text-xs font-semibold">7. Devi includere</Label>
              <Textarea
                id="must"
                value={data.mustHave}
                onChange={(e) => update("mustHave", e.target.value)}
                placeholder="Es: menzione TMWE, riferimento WCA"
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mustnot" className="text-xs font-semibold">8. Non devi mai</Label>
              <Textarea
                id="mustnot"
                value={data.mustNotHave}
                onChange={(e) => update("mustNotHave", e.target.value)}
                placeholder="Es: prezzi, promesse contrattuali"
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          {/* EXTRA CONSTRAINTS */}
          <div className="space-y-1">
            <Label htmlFor="extra" className="text-xs font-semibold">9. Vincoli aggiuntivi (opzionale)</Label>
            <Input
              id="extra"
              value={data.extraConstraints}
              onChange={(e) => update("extraConstraints", e.target.value)}
              placeholder="Es: max 3 frasi, tono confidenziale, evita gergo logistico"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button
            onClick={() => onConfirm(data)}
            disabled={!canConfirm || loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Genera con questo briefing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}