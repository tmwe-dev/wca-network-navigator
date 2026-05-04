import * as React from "react";
import {
  Clock, MessageSquare, ShieldAlert, Mail, MessageCircle, Linkedin,
  Phone, StickyNote, Search, ArrowUpRight, ArrowDownLeft, Plus, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";
import { ActivityList } from "@/components/partners/ActivityList";
import { AddNoteDialog } from "@/components/partners/AddNoteDialog";

interface Interaction {
  id: string;
  interaction_type?: string;
  subject?: string;
  interaction_date: string;
  notes?: string;
  // Optional enrichment when available from joins
  channel?: string | null;
  direction?: "inbound" | "outbound" | string | null;
  contact_name?: string | null;
  contact_address?: string | null;
  country_code?: string | null;
  message_id?: string | null;
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

function channelMeta(type?: string | null, channel?: string | null) {
  const k = (channel || type || "").toLowerCase();
  if (k.includes("whatsapp") || k === "wa") return { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-500" };
  if (k.includes("linkedin") || k === "li") return { icon: Linkedin, label: "LinkedIn", color: "text-sky-500" };
  if (k === "call" || k.includes("phone")) return { icon: Phone, label: "Chiamata", color: "text-amber-500" };
  if (k === "meeting") return { icon: MessageSquare, label: "Incontro", color: "text-violet-400" };
  if (k === "note") return { icon: StickyNote, label: "Nota", color: "text-muted-foreground" };
  if (k.includes("deep_search") || k.includes("sherlock")) return { icon: Search, label: "Deep Search", color: "text-amber-400" };
  return { icon: Mail, label: "Email", color: "text-primary" };
}

function flagEmoji(cc?: string | null) {
  if (!cc || cc.length !== 2) return "";
  const A = 127397;
  return String.fromCodePoint(...cc.toUpperCase().split("").map(c => c.charCodeAt(0) + A));
}

export function PartnerDetailActivity({ partnerId, interactions, reminders, isBlacklisted, blacklistEntries }: PartnerDetailActivityProps) {
  const [noteOpen, setNoteOpen] = React.useState(false);
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
        <div className="flex items-center justify-between">
          <SectionTitle icon={MessageSquare}>Timeline ({interactions.length})</SectionTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Nota
            </button>
            <Link
              to={`/v2/agenda?partnerId=${partnerId}`}
              className="text-[10px] px-2 py-1 rounded-md bg-card border border-primary/10 hover:bg-primary/5 inline-flex items-center gap-1 text-muted-foreground"
            >
              Storia completa <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
        {!interactions.length ? (
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-20" />
            <p className="text-xs">Nessuna interazione</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {interactions.map((it_) => {
              const meta = channelMeta(it_.interaction_type, it_.channel);
              const Icon = meta.icon;
              const isInbound = it_.direction === "inbound";
              const DirIcon = isInbound ? ArrowDownLeft : ArrowUpRight;
              const flag = flagEmoji(it_.country_code);
              const d = new Date(it_.interaction_date);
              return (
                <div key={it_.id} className="flex gap-2.5 p-2.5 rounded-lg bg-card/60 border border-primary/10 hover:bg-primary/5 transition-colors">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary/5 border border-primary/10",
                    meta.color,
                  )}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <DirIcon className={cn("w-3 h-3 shrink-0", isInbound ? "text-emerald-500" : "text-sky-500")} />
                      {flag && <span className="text-[11px]" aria-hidden>{flag}</span>}
                      <span className="text-[11px] text-foreground/90 font-medium truncate">
                        {it_.contact_name || meta.label}
                      </span>
                      {it_.contact_address && (
                        <span className="text-[10px] text-muted-foreground truncate">· {it_.contact_address}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                        {format(d, "d MMM · HH:mm", { locale: it })}
                      </span>
                    </div>
                    {it_.subject && (
                      <p className="font-medium text-xs text-foreground mt-0.5 truncate">{it_.subject}</p>
                    )}
                    {it_.notes && <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-2">{it_.notes}</p>}
                    {it_.message_id && (
                      <Link
                        to={`/v2/inbox?messageId=${it_.message_id}`}
                        className="text-[10px] text-primary inline-flex items-center gap-0.5 mt-1 hover:underline"
                      >
                        Apri messaggio <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
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
      <AddNoteDialog open={noteOpen} onOpenChange={setNoteOpen} partnerId={partnerId} />
    </>
  );
}
