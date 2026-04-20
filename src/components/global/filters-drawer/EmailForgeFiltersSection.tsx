/**
 * EmailForgeFiltersSection — drawer "linguetta" content for /v2/ai-staff/email-forge.
 * Layout iconico: tipo email + tono + qualità in righe orizzontali con icone,
 * KB compatto, obiettivo+proposta full-width impilate verticalmente.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Mail,
  User as UserIcon,
  BookOpen,
  Target,
  Award,
  PersonStanding,
  Search,
  Briefcase,
  Handshake,
  Truck,
  GraduationCap,
  UserCheck,
  Smile,
  Hand,
  Zap,
  ThumbsUp,
  Trophy,
  Gauge,
  FileText,
} from "lucide-react";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";
import { ForgeRecipientPicker } from "@/v2/ui/pages/email-forge/ForgeRecipientPicker";
import { forgeLabStore, useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { FilterSection } from "./shared";
import { cn } from "@/lib/utils";

// Mappa id tipo-email → icona richiesta
const EMAIL_TYPE_ICON: Record<string, React.ElementType> = {
  primo_contatto: Award,        // medaglia
  follow_up: PersonStanding,    // uomo in corsa
  richiesta_info: Search,       // lente
  proposta: Briefcase,          // valigetta
  partnership: Handshake,       // mani che si stringono
  network_espresso: Truck,      // camioncino
};

const TONE_ITEMS = [
  { value: "formale", label: "Formale", Icon: GraduationCap },
  { value: "professionale", label: "Professionale", Icon: UserCheck },
  { value: "amichevole", label: "Amichevole", Icon: Smile },
  { value: "diretto", label: "Diretto", Icon: Hand },
];

const QUALITY_ITEMS: Array<{ value: "fast" | "standard" | "premium"; label: string; Icon: React.ElementType }> = [
  { value: "fast", label: "Fast", Icon: Zap },
  { value: "standard", label: "Standard", Icon: ThumbsUp },
  { value: "premium", label: "Premium", Icon: Trophy },
];

function IconTile({
  active,
  onClick,
  Icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ElementType;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-md border px-1 py-1.5 transition-colors min-w-0",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/40 hover:border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-[9px] leading-tight font-medium truncate w-full text-center">{label}</span>
    </button>
  );
}

export function EmailForgeFiltersSection() {
  const lab = useForgeLab();

  return (
    <div className="space-y-2">
      {/* TIPO EMAIL — 6 icone in riga orizzontale */}
      <FilterSection icon={Mail} label="Tipo email">
        <div className="grid grid-cols-6 gap-1">
          {DEFAULT_EMAIL_TYPES.map((t) => {
            const Icon = EMAIL_TYPE_ICON[t.id] ?? Mail;
            return (
              <IconTile
                key={t.id}
                active={lab.emailType?.id === t.id}
                onClick={() => forgeLabStore.set({ emailType: t })}
                Icon={Icon}
                label={t.name}
                title={t.name}
              />
            );
          })}
        </div>
      </FilterSection>

      {/* STILE — 4 toni a icona */}
      <FilterSection icon={BookOpen} label="Stile">
        <div className="grid grid-cols-4 gap-1">
          {TONE_ITEMS.map((t) => (
            <IconTile
              key={t.value}
              active={lab.tone === t.value}
              onClick={() => forgeLabStore.set({ tone: t.value })}
              Icon={t.Icon}
              label={t.label}
            />
          ))}
        </div>
      </FilterSection>

      {/* QUALITÀ + KB sulla stessa riga: 3 icone qualità + box KB compatto */}
      <FilterSection icon={Gauge} label="Qualità & KB">
        <div className="grid grid-cols-4 gap-1">
          {QUALITY_ITEMS.map((q) => (
            <IconTile
              key={q.value}
              active={lab.quality === q.value}
              onClick={() => forgeLabStore.set({ quality: q.value })}
              Icon={q.Icon}
              label={q.label}
            />
          ))}
          <button
            type="button"
            onClick={() => forgeLabStore.set({ useKB: !lab.useKB })}
            title={lab.useKB ? "Knowledge Base attiva" : "Knowledge Base disattiva"}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md border px-1 py-1.5 transition-colors",
              lab.useKB
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 hover:border-border bg-card text-muted-foreground"
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-[9px] leading-tight font-medium">
              KB {lab.useKB ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      </FilterSection>

      {/* OBIETTIVO + PROPOSTA — full width impilati */}
      <FilterSection icon={Target} label="Obiettivo">
        <Textarea
          value={lab.customGoal}
          onChange={(e) => forgeLabStore.set({ customGoal: e.target.value })}
          placeholder="Obiettivo (es. scambio IT→USA)"
          className="min-h-[56px] text-[11px] resize-none w-full"
        />
      </FilterSection>

      <FilterSection icon={FileText} label="Proposta base">
        <Textarea
          value={lab.baseProposal}
          onChange={(e) => forgeLabStore.set({ baseProposal: e.target.value })}
          placeholder="Proposta base (opzionale)"
          className="min-h-[56px] text-[11px] resize-none w-full"
        />
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
