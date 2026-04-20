/**
 * ForgeSummaryPanel — riassunto compatto, read-only, della configurazione
 * corrente. Tutta la modifica avviene dalla linguetta laterale (FiltersDrawer).
 */
import * as React from "react";
import { Sparkles, User, Mail, BookOpen, Target, Globe } from "lucide-react";
import { useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { getCountryFlag } from "@/lib/countries";

export function ForgeSummaryPanel() {
  const lab = useForgeLab();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 shrink-0 text-xs font-medium">
        <Sparkles className="w-3.5 h-3.5" /> Configurazione attiva
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4 text-xs">
        {/* Tipo email */}
        <Section icon={Mail} label="Tipo email">
          <div className="text-foreground font-medium">
            {lab.emailType?.name ?? <span className="text-muted-foreground italic">Non selezionato</span>}
          </div>
        </Section>

        {/* Stile */}
        <Section icon={BookOpen} label="Stile">
          <div className="space-y-0.5 text-[11px]">
            <div><span className="text-muted-foreground">Tono:</span> <span className="text-primary">{lab.tone}</span></div>
            <div><span className="text-muted-foreground">Quality:</span> <span className="text-primary">{lab.quality}</span></div>
            <div>
              <span className="text-muted-foreground">Knowledge Base:</span>{" "}
              <span className={lab.useKB ? "text-primary" : "text-muted-foreground"}>
                {lab.useKB ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </Section>

        {/* Obiettivo */}
        {(lab.customGoal || lab.baseProposal) && (
          <Section icon={Target} label="Obiettivo">
            {lab.customGoal && (
              <div className="text-[11px] whitespace-pre-wrap text-foreground">{lab.customGoal}</div>
            )}
            {lab.baseProposal && (
              <div className="mt-1.5 text-[11px] whitespace-pre-wrap text-foreground">
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground block mb-0.5">Proposta base</span>
                {lab.baseProposal}
              </div>
            )}
          </Section>
        )}

        {/* Destinatario */}
        <Section icon={User} label="Destinatario">
          {lab.recipient ? (
            <div className="space-y-0.5">
              <div className="font-medium truncate">{lab.recipient.companyName || "(senza azienda)"}</div>
              {lab.recipient.contactName && (
                <div className="text-muted-foreground truncate">{lab.recipient.contactName}</div>
              )}
              {lab.recipient.email && (
                <div className="text-[10px] text-muted-foreground truncate">{lab.recipient.email}</div>
              )}
              <div className="flex items-center gap-2 pt-0.5 text-[10px] text-muted-foreground">
                <span>
                  {lab.recipient.source === "partner" ? "Partner WCA" :
                   lab.recipient.source === "contact" ? "Contatto" :
                   lab.recipient.source === "bca" ? "BCA" : "Manuale"}
                </span>
                {lab.recipient.countryCode && (
                  <span className="inline-flex items-center gap-0.5">
                    <Globe className="w-2.5 h-2.5" /> {getCountryFlag(lab.recipient.countryCode)} {lab.recipient.countryCode}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground italic">Nessun destinatario selezionato</div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary/80">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="pl-4">{children}</div>
    </section>
  );
}
