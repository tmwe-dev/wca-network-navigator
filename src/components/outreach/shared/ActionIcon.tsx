/**
 * ActionIcon — Mappa "tipo di azione/evento" → icona + colore + label italiana.
 * Usato in Storico Attività, In Uscita, Risposte per dare un cue visivo immediato
 * di cosa è successo (anziché mostrare stringhe tecniche tipo "send_email").
 */
import {
  Mail, MessageCircle, Linkedin, Phone, Users, RotateCcw,
  Bot, Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight, FileText, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionKind =
  | "email_sent" | "email_received" | "email_pending"
  | "whatsapp_sent" | "whatsapp_received"
  | "linkedin_sent" | "linkedin_received"
  | "phone_call" | "meeting" | "follow_up"
  | "ai_proposal" | "scheduled" | "note" | "other";

const MAP: Record<ActionKind, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  email_sent:        { icon: Mail,           color: "text-blue-400",     bg: "bg-blue-500/15",    label: "Email inviata" },
  email_received:    { icon: ArrowDownLeft,  color: "text-emerald-500",  bg: "bg-emerald-500/15", label: "Email ricevuta" },
  email_pending:     { icon: Mail,           color: "text-primary",      bg: "bg-primary/15",     label: "Email pronta" },
  whatsapp_sent:     { icon: MessageCircle,  color: "text-emerald-500",  bg: "bg-emerald-500/15", label: "WhatsApp inviato" },
  whatsapp_received: { icon: MessageCircle,  color: "text-emerald-500",  bg: "bg-emerald-500/15", label: "WhatsApp ricevuto" },
  linkedin_sent:     { icon: Linkedin,       color: "text-blue-400",     bg: "bg-blue-500/15",    label: "LinkedIn inviato" },
  linkedin_received: { icon: Linkedin,       color: "text-blue-400",     bg: "bg-blue-500/15",    label: "LinkedIn ricevuto" },
  phone_call:        { icon: Phone,          color: "text-amber-500",    bg: "bg-amber-500/15",   label: "Chiamata" },
  meeting:           { icon: Users,          color: "text-purple-400",   bg: "bg-purple-500/15",  label: "Meeting" },
  follow_up:         { icon: RotateCcw,      color: "text-amber-500",    bg: "bg-amber-500/15",   label: "Follow-up" },
  ai_proposal:       { icon: Sparkles,       color: "text-primary",      bg: "bg-primary/15",     label: "Proposta AI" },
  scheduled:         { icon: CalendarIcon,   color: "text-muted-foreground", bg: "bg-muted",      label: "Pianificata" },
  note:              { icon: FileText,       color: "text-muted-foreground", bg: "bg-muted",      label: "Nota" },
  other:             { icon: Bot,            color: "text-muted-foreground", bg: "bg-muted",      label: "Attività" },
};

/** Risolve un kind partendo dal tipo grezzo dell'attività + direzione. */
export function resolveActionKind(input: {
  activityType?: string | null;
  direction?: "inbound" | "outbound" | null;
  channel?: string | null;
  isAi?: boolean;
}): ActionKind {
  const t = (input.activityType || "").toLowerCase();
  const ch = (input.channel || "").toLowerCase();
  const inbound = input.direction === "inbound";

  if (input.isAi && (t.includes("follow") || t.includes("proposal") || t === "agent_task")) return "ai_proposal";
  if (t.includes("phone") || t === "call" || ch === "phone") return "phone_call";
  if (t.includes("meeting")) return "meeting";
  if (t.includes("note")) return "note";
  if (t.includes("follow")) return "follow_up";

  if (t.includes("whatsapp") || ch === "whatsapp") return inbound ? "whatsapp_received" : "whatsapp_sent";
  if (t.includes("linkedin") || ch === "linkedin") return inbound ? "linkedin_received" : "linkedin_sent";
  if (t.includes("email") || t.includes("send_email") || ch === "email") {
    if (inbound) return "email_received";
    return "email_sent";
  }
  return "other";
}

interface ActionIconProps {
  readonly kind: ActionKind;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

export function ActionIcon({ kind, size = "md", className }: ActionIconProps) {
  const cfg = MAP[kind];
  const Icon = cfg.icon;
  const sizeCls = size === "sm" ? "w-6 h-6" : "w-7 h-7";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className={cn("rounded-md flex items-center justify-center shrink-0", sizeCls, cfg.bg, className)} title={cfg.label}>
      <Icon className={cn(iconSize, cfg.color)} />
    </div>
  );
}

export function actionLabel(kind: ActionKind): string {
  return MAP[kind].label;
}
