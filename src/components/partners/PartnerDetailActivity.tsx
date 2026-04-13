import { Clock, MessageSquare, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ActivityList } from "@/components/partners/ActivityList";

interface Interaction {
  id: string;
  interaction_type?: string;
  subject?: string;
  interaction_date: string;
  notes?: string;
}

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  status: string;
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "bg-gradient-to-br from-primary/5 via-card to-primary/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4 space-y-2",
      className
    )}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{children}</p>
    </div>
  );
}

interface PartnerDetailActivityProps {
  partnerId: string;
  interactions: Interaction[];
  reminders: Reminder[];
  isBlacklisted: boolean;
  blacklistEntries: { total_owed_amount?: number | null }[];
}

export function PartnerDetailActivity({ partnerId, interactions, reminders, isBlacklisted, blacklistEntries }: PartnerDetailActivityProps) {
  return (
    <>
      {isBlacklisted && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">⚠️ BLACKLIST WCA</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {blacklistEntries.length} segnalazione/i.
              {blacklistEntries[0]?.total_owed_amount && (
                <> Importo: <strong>${Number(blacklistEntries[0].total_owed_amount).toLocaleString()}</strong></>
              )}
            </p>
          </div>
        </div>
      )}

      <ActivityList partnerId={partnerId} />

      <Section>
        <SectionTitle icon={MessageSquare}>Timeline ({interactions.length})</SectionTitle>
        {!interactions.length ? (
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-20" />
            <p className="text-xs">Nessuna interazione</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="flex gap-2.5 p-2.5 rounded-lg bg-card/60 border border-primary/10 hover:bg-primary/5 transition-colors">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-primary/10 text-primary border border-primary/20">
                  {interaction.interaction_type?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-xs text-foreground">{interaction.subject}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(interaction.interaction_date), "d MMM yyyy", { locale: it })}
                    </span>
                  </div>
                  {interaction.notes && <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-2">{interaction.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {reminders?.length > 0 && (
        <Section>
          <SectionTitle icon={Clock}>Promemoria</SectionTitle>
          <div className="space-y-1.5">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-primary/10">
                <div>
                  <p className="font-medium text-xs text-foreground">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(r.due_date), "d MMM yyyy", { locale: it })}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium border",
                  r.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"
                )}>
                  {r.status === "completed" ? "Completato" : "In attesa"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
