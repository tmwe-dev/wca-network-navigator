/**
 * EmailForgeFiltersSection — drawer "linguetta" content for /v2/ai-staff/email-forge.
 * Contains the recipient picker + email type / tone / KB / quality / goal,
 * pushing config into the shared forgeLabStore so the page reacts.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Mail, User as UserIcon, BookOpen, Target } from "lucide-react";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS } from "@/data/defaultEmailTypes";
import { ForgeRecipientPicker } from "@/v2/ui/pages/email-forge/ForgeRecipientPicker";
import { forgeLabStore, useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { FilterSection } from "./shared";

export function EmailForgeFiltersSection() {
  const lab = useForgeLab();

  return (
    <div className="space-y-2">
      <FilterSection icon={Mail} label="Tipo email">
        <div className="grid grid-cols-3 gap-1">
          {DEFAULT_EMAIL_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => forgeLabStore.set({ emailType: t })}
              className={`text-[10px] leading-tight rounded border px-1.5 py-1 text-left transition-colors ${
                lab.emailType?.id === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 hover:border-border bg-card"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection icon={BookOpen} label="Stile & modello">
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">Tono</Label>
              <Select value={lab.tone} onValueChange={(v) => forgeLabStore.set({ tone: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">Quality</Label>
              <Select value={lab.quality} onValueChange={(v) => forgeLabStore.set({ quality: v as "fast" | "standard" | "premium" })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={4} avoidCollisions={false}>
                  <SelectItem value="fast" className="text-xs">Fast</SelectItem>
                  <SelectItem value="standard" className="text-xs">Standard</SelectItem>
                  <SelectItem value="premium" className="text-xs">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded border border-border/40 bg-card px-2 py-1">
            <Label htmlFor="forge-kb" className="text-[11px] cursor-pointer">Usa Knowledge Base</Label>
            <Switch
              id="forge-kb"
              checked={lab.useKB}
              onCheckedChange={(v) => forgeLabStore.set({ useKB: v })}
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection icon={Target} label="Obiettivo">
        <div className="grid grid-cols-2 gap-1.5">
          <Textarea
            value={lab.customGoal}
            onChange={(e) => forgeLabStore.set({ customGoal: e.target.value })}
            placeholder="Obiettivo (es. scambio IT→USA)"
            className="min-h-[56px] text-[11px] resize-none"
          />
          <Textarea
            value={lab.baseProposal}
            onChange={(e) => forgeLabStore.set({ baseProposal: e.target.value })}
            placeholder="Proposta base (opzionale)"
            className="min-h-[56px] text-[11px] resize-none"
          />
        </div>
      </FilterSection>

      <FilterSection icon={UserIcon} label="Destinatario">
        <ForgeRecipientPicker
          value={lab.recipient}
          onChange={(r) => forgeLabStore.set({ recipient: r })}
        />
      </FilterSection>

      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          forgeLabStore.triggerRun();
          window.dispatchEvent(new CustomEvent("filters-drawer-close"));
        }}
      >
        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
        Genera + Ispeziona
      </Button>
    </div>
  );
}
