/**
 * ForgeOraclePanel — left panel of Email Forge.
 * SEMPLIFICATO: destinatario · tipo email (4 + altri) · obiettivo · CTA Genera.
 * Tutto il resto (tono, quality, KB, base proposal) dentro Collapsible "Opzioni avanzate".
 * Sincronizza con forgeLabStore così i valori restano coerenti col drawer globale.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Loader2, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import { ForgeRecipientPicker, type ForgeRecipient } from "./ForgeRecipientPicker";
import { cn } from "@/lib/utils";
import { forgeLabStore, useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { EnrichmentStatusInline } from "./EnrichmentStatusInline";
import { ContextSummary } from "./components/ContextSummary";
import { usePreContext } from "./hooks/usePreContext";

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
  onRun: (config: ForgeConfig) => void;
  isLoading: boolean;
}

const PRIMARY_TYPES_COUNT = 4;

export function ForgeOraclePanel({ onRun, isLoading }: Props): React.ReactElement {
  const lab = useForgeLab();
  const [showAllTypes, setShowAllTypes] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const preContext = usePreContext(lab.recipient, {
    kbCategories: lab.emailType?.kb_categories,
    language: "italiano",
    tone: lab.tone,
  });

  const visibleTypes = showAllTypes ? DEFAULT_EMAIL_TYPES : DEFAULT_EMAIL_TYPES.slice(0, PRIMARY_TYPES_COUNT);
  const hasMoreTypes = DEFAULT_EMAIL_TYPES.length > PRIMARY_TYPES_COUNT;

  const handleRecipient = (r: ForgeRecipient | null) => forgeLabStore.set({ recipient: r });
  const handleEmailType = (t: EmailType) => forgeLabStore.set({ emailType: t });

  const handleSubmit = () => {
    onRun({
      recipient: lab.recipient,
      emailType: lab.emailType,
      tone: lab.tone,
      useKB: lab.useKB,
      customGoal: lab.customGoal,
      baseProposal: lab.baseProposal,
      quality: lab.quality,
    });
  };

  const canGenerate = !!lab.recipient && !!lab.emailType && !isLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 shrink-0 text-xs font-medium">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Configurazione
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* DESTINATARIO */}
        <section className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/80">Destinatario</Label>
          <ForgeRecipientPicker value={lab.recipient} onChange={handleRecipient} />
          {lab.recipient?.partnerId && (
            <EnrichmentStatusInline partnerId={lab.recipient.partnerId} />
          )}
          {preContext && (
            <div className="pt-1">
              <ContextSummary preContext={preContext} mode="compact" />
            </div>
          )}
        </section>

        {/* TIPO EMAIL */}
        <section className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/80">Tipo email</Label>
          <div className="grid grid-cols-2 gap-2">
            {visibleTypes.map((t) => {
              const active = lab.emailType?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleEmailType(t)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border/60 text-foreground/80 hover:bg-muted hover:border-border",
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          {hasMoreTypes && (
            <button
              type="button"
              onClick={() => setShowAllTypes((v) => !v)}
              className="text-xs text-foreground/70 hover:text-foreground flex items-center gap-1"
            >
              {showAllTypes ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showAllTypes ? "Mostra solo principali" : `Altri tipi (${DEFAULT_EMAIL_TYPES.length - PRIMARY_TYPES_COUNT})`}
            </button>
          )}
        </section>

        {/* OBIETTIVO */}
        <section className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-foreground/80">Obiettivo</Label>
          <Textarea
            value={lab.customGoal}
            onChange={(e) => forgeLabStore.set({ customGoal: e.target.value })}
            placeholder="Cosa vuoi ottenere con questa email?"
            className="text-sm min-h-[60px]"
            rows={2}
          />
        </section>

        {/* OPZIONI AVANZATE */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground w-full">
            <ChevronsUpDown className="w-3 h-3" />
            <span>Opzioni avanzate</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3 pt-3 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">Tono</Label>
              <Select value={lab.tone} onValueChange={(v) => forgeLabStore.set({ tone: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">Quality (modello AI)</Label>
              <Select
                value={lab.quality}
                onValueChange={(v) => forgeLabStore.set({ quality: v as ForgeConfig["quality"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast" className="text-xs">⚡ Fast — veloce ed economico</SelectItem>
                  <SelectItem value="standard" className="text-xs">👍 Standard — bilanciato</SelectItem>
                  <SelectItem value="premium" className="text-xs">🏆 Premium — massima qualità</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="kb" className="text-xs text-foreground/80">Usa Knowledge Base</Label>
              <Switch id="kb" checked={lab.useKB} onCheckedChange={(v) => forgeLabStore.set({ useKB: v })} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-foreground/80">Proposta base (opzionale)</Label>
              <Textarea
                value={lab.baseProposal}
                onChange={(e) => forgeLabStore.set({ baseProposal: e.target.value })}
                placeholder="Es. partnership reciproca, primi 3 spedizioni a tariffa scontata"
                className="min-h-[60px] text-xs"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* CTA GENERA — sticky bottom */}
      <div className="p-3 border-t border-border/60 shrink-0 bg-card/40">
        <Button
          onClick={handleSubmit}
          disabled={!canGenerate}
          className="w-full h-12 text-base font-semibold gap-2"
          size="lg"
        >
          {isLoading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Generazione…</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Genera Email</>
          )}
        </Button>
        {!lab.recipient && (
          <p className="text-xs text-foreground/60 mt-2 text-center">
            Seleziona un destinatario per generare
          </p>
        )}
      </div>
    </div>
  );
}
