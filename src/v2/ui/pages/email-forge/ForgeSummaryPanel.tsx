/**
 * ForgeSummaryPanel — riassunto compatto della configurazione corrente
 * (destinatario, tipo email, tono, KB). I controlli sono nella linguetta
 * laterale (FiltersDrawer / EmailForgeFiltersSection).
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, User, Mail, Sparkles, BookOpen, Target, Globe } from "lucide-react";
import { useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { getCountryFlag } from "@/lib/countries";

interface Props {
  onOpenDrawer: () => void;
}

export function ForgeSummaryPanel({ onOpenDrawer }: Props) {
  const lab = useForgeLab();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" /> Configurazione attiva
        </div>
        <Button size="sm" variant="ghost" onClick={onOpenDrawer} className="h-6 text-[10px] gap-1">
          <SlidersHorizontal className="w-3 h-3" /> Modifica
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-xs">
        {/* Destinatario */}
        <Section icon={User} label="Destinatario">
          {lab.recipient ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1">
              <div className="font-medium truncate">{lab.recipient.companyName || "(senza azienda)"}</div>
              {lab.recipient.contactName && (
                <div className="text-muted-foreground truncate">{lab.recipient.contactName}</div>
              )}
              {lab.recipient.email && (
                <div className="text-[10px] text-muted-foreground truncate">{lab.recipient.email}</div>
              )}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  {lab.recipient.source === "partner" ? "Partner WCA" :
                   lab.recipient.source === "contact" ? "Contatto" :
                   lab.recipient.source === "bca" ? "BCA" : "Manuale"}
                </Badge>
                {lab.recipient.countryCode && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" /> {getCountryFlag(lab.recipient.countryCode)} {lab.recipient.countryCode}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <EmptyHint onOpenDrawer={onOpenDrawer}>
              Nessun destinatario selezionato. Apri la linguetta a sinistra per cercare un Partner, Contatto o BCA.
            </EmptyHint>
          )}
        </Section>

        {/* Tipo email */}
        <Section icon={Mail} label="Tipo email">
          {lab.emailType ? (
            <div className="rounded-md border border-border/40 bg-card p-2">
              <div className="font-medium">{lab.emailType.name}</div>
              {lab.emailType.description && (
                <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{lab.emailType.description}</div>
              )}
            </div>
          ) : (
            <EmptyHint onOpenDrawer={onOpenDrawer}>Scegli un tipo email.</EmptyHint>
          )}
        </Section>

        {/* Stile */}
        <Section icon={BookOpen} label="Stile">
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px]">Tono: {lab.tone}</Badge>
            <Badge variant="secondary" className="text-[10px]">{lab.quality}</Badge>
            <Badge
              variant={lab.useKB ? "default" : "outline"}
              className="text-[10px]"
            >
              KB {lab.useKB ? "ON" : "OFF"}
            </Badge>
          </div>
        </Section>

        {/* Goal */}
        {(lab.customGoal || lab.baseProposal) && (
          <Section icon={Target} label="Obiettivo">
            {lab.customGoal && (
              <div className="rounded border border-border/40 bg-muted/30 p-2 text-[11px] whitespace-pre-wrap">
                {lab.customGoal}
              </div>
            )}
            {lab.baseProposal && (
              <div className="rounded border border-border/40 bg-muted/30 p-2 text-[11px] whitespace-pre-wrap mt-1">
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground block mb-0.5">Proposta base</span>
                {lab.baseProposal}
              </div>
            )}
          </Section>
        )}

        <div className="pt-2 border-t border-border/30">
          <Button size="sm" variant="outline" onClick={onOpenDrawer} className="w-full h-8 text-[11px] gap-1.5">
            <SlidersHorizontal className="w-3 h-3" /> Apri configurazione completa
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children, onOpenDrawer }: { children: React.ReactNode; onOpenDrawer: () => void }) {
  return (
    <button
      onClick={onOpenDrawer}
      className="w-full text-left rounded-md border border-dashed border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
