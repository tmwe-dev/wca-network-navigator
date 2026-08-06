/**
 * AgentRolesOverviewPage — "Chi fa cosa".
 * Vista SOLA LETTURA che mostra, dai dati reali, ogni agente operativo:
 * ruolo, canali abilitati, numero di tool, se ha istruzioni (persona)
 * configurate, e DOVE quelle istruzioni vengono effettivamente usate dal
 * sistema. In fondo: lo stato delle strategie email post-attesa.
 * Nessuna logica di business: nessuna scrittura, nessun side-effect.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Mail, MessageSquare, Inbox, Wrench, BookOpen, Bell, MailCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fetchAgentRolesOverview } from "@/data/agentRolesOverview";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AgentRolesOverviewRawAgent as AgentRow } from "@/data/agentRolesOverview";

/** Descrizione umana di "chi fa cosa" per ruolo. */
const ROLE_INFO: Record<string, { label: string; does: string }> = {
  director: { label: "Direttore", does: "Coordina gli altri agenti, decide strategia e priorità." },
  strategy: { label: "Strategia", does: "Pianifica cadenze, segmenti e prossime mosse commerciali." },
  outreach: { label: "Outreach", does: "Scrive e invia il primo contatto e i follow-up multicanale." },
  sales: { label: "Sales", does: "Gestisce la trattativa, risponde alle obiezioni, chiude." },
  account: { label: "Account", does: "Cura la relazione coi clienti attivi e il post-vendita." },
  research: { label: "Ricerca", does: "Trova e arricchisce lead (scraping, deep search)." },
  download: { label: "Acquisizione", does: "Importa e normalizza i dati in ingresso." },
  curator: { label: "Curatore", does: "Classifica e ordina i contenuti / la inbox." },
  inbox_curator: { label: "Curatore Inbox", does: "Smista le email in arrivo e propone azioni." },
  assistant: { label: "Assistente", does: "Supporto generico conversazionale." },
};

function roleInfo(role: string) {
  return ROLE_INFO[role?.toLowerCase?.()] ?? { label: role || "—", does: "Ruolo non classificato." };
}

function toolCount(t: unknown): number {
  return Array.isArray(t) ? t.length : 0;
}

export function AgentRolesOverviewPage(): React.ReactElement {
  const { data, isLoading } = useQuery({
    queryKey: ["agents", "roles-overview"],
    queryFn: async () => {
      const raw = await fetchAgentRolesOverview();

      const personaSet = new Set(raw.personas.map((p) => p.agent_id));
      const capsMap = new Map<string, { tools: number; mode: string }>();
      for (const c of raw.capabilities) {
        capsMap.set(c.agent_id, {
          tools: Array.isArray(c.allowed_tools) ? c.allowed_tools.length : 0,
          mode: (c.execution_mode as string) ?? "supervised",
        });
      }

      const agents = (raw.agents as AgentRow[]).map((a) => ({
        ...a,
        hasPersona: personaSet.has(a.id),
        caps: capsMap.get(a.id) ?? null,
      }));

      const autoTotal = raw.autoresponderTemplates.length;
      const autoEnabled = raw.autoresponderTemplates.filter((t) => t.enabled).length;
      const wakeTotal = raw.wakeUpRules.length;
      const wakeActive = raw.wakeUpRules.filter((r) => r.is_active).length;

      return { agents, autoTotal, autoEnabled, wakeTotal, wakeActive };
    },
  });

  const agents = data?.agents ?? [];

  return (
    <>
      <PageTitleHeader icon={Users} title="Chi fa cosa" subtitle="Ruoli, istruzioni e strategie email" />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Spiegazione orientamento */}
        <Card className="p-4 bg-muted/30">
          <p className="text-sm text-foreground font-medium mb-1">Come è organizzato il sistema</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li><span className="text-foreground">Ogni agente</span> ha un ruolo e dei canali abilitati (email, WhatsApp, inbox).</li>
            <li><span className="text-foreground">Le istruzioni</span> (tono, regole, vocabolario) di ogni agente si definiscono nella sua <span className="text-foreground">Persona</span>; i tool che può usare nelle <span className="text-foreground">Capability</span>.</li>
            <li>La chat con l'agente serve a <span className="text-foreground">testarlo/parlarci</span>, non a istruirlo: per istruirlo si modifica la Persona.</li>
          </ul>
        </Card>

        {/* Agenti */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Agenti operativi attivi {agents.length > 0 && <span className="text-muted-foreground font-normal">({agents.length})</span>}</h2>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Caricamento…</p>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun agente operativo attivo.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((a) => {
                const info = roleInfo(a.role);
                const tools = a.caps?.tools ?? toolCount(a.assigned_tools);
                return (
                  <Card key={a.id} className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{a.avatar_emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">{info.label}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{info.does}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {a.can_send_email && <Badge variant="secondary" className="text-[10px] gap-1"><Mail className="w-3 h-3" />Email</Badge>}
                      {a.can_send_whatsapp && <Badge variant="secondary" className="text-[10px] gap-1"><MessageSquare className="w-3 h-3" />WhatsApp</Badge>}
                      {a.can_access_inbox && <Badge variant="secondary" className="text-[10px] gap-1"><Inbox className="w-3 h-3" />Inbox</Badge>}
                      <Badge variant="outline" className="text-[10px] gap-1"><Wrench className="w-3 h-3" />{tools} tool</Badge>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      {a.hasPersona ? (
                        <span className="text-foreground">Istruzioni configurate (Persona)</span>
                      ) : (
                        <span className="text-muted-foreground">Istruzioni non personalizzate</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Strategie email post-attesa */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Strategie email dopo il circuito di attesa</h2>
            <Link to="/v2/agents/email-strategies" className="text-xs text-primary hover:underline">Gestisci →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StrategyCard
              icon={MailCheck}
              title="Il cliente HA scritto"
              desc="Risposte automatiche / onboarding inviate quando il cliente risponde."
              ready={(data?.autoEnabled ?? 0) > 0}
              detail={`${data?.autoEnabled ?? 0} attivi su ${data?.autoTotal ?? 0} template`}
            />
            <StrategyCard
              icon={Bell}
              title="Il cliente NON riscrive"
              desc="Regole di risveglio (wake-up) dopo X giorni di silenzio."
              ready={(data?.wakeActive ?? 0) > 0}
              detail={
                (data?.wakeTotal ?? 0) === 0
                  ? "Nessuna regola definita"
                  : `${data?.wakeActive ?? 0} attive su ${data?.wakeTotal ?? 0} regole`
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StrategyCard({
  icon: Icon,
  title,
  desc,
  ready,
  detail,
}: {
  icon: typeof Mail;
  title: string;
  desc: string;
  ready: boolean;
  detail: string;
}): React.ReactElement {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <div className={cn("flex items-center gap-1.5 text-[11px]", ready ? "text-success" : "text-warning")}>
        {ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        {detail}
      </div>
    </Card>
  );
}
