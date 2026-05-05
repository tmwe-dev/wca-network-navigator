import {
  Mail, MessageCircle, Linkedin, Phone, Megaphone, ArrowUpRight,
  Bot, Pencil, RefreshCw,
} from "lucide-react";
import type { CestinoChannel, CestinoStatus, CestinoTrigger } from "@/data/cestinone";

export const CHANNEL_META: Record<CestinoChannel, {
  label: string;
  Icon: typeof Mail;
  tone: string;
  bg: string;
  borderL: string;
}> = {
  email:    { label: "Email",    Icon: Mail,          tone: "text-violet-500",  bg: "bg-violet-500/10",  borderL: "border-l-violet-500" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, tone: "text-emerald-500", bg: "bg-emerald-500/10", borderL: "border-l-emerald-500" },
  linkedin: { label: "LinkedIn", Icon: Linkedin,      tone: "text-sky-500",     bg: "bg-sky-500/10",     borderL: "border-l-sky-500" },
  voice:    { label: "Voce",     Icon: Phone,         tone: "text-orange-500",  bg: "bg-orange-500/10",  borderL: "border-l-orange-500" },
  other:    { label: "Altro",    Icon: Mail,          tone: "text-muted-foreground", bg: "bg-muted",     borderL: "border-l-muted" },
};

export const STATUS_META: Record<CestinoStatus, { label: string; tone: string }> = {
  pending:   { label: "Da approvare", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  scheduled: { label: "Schedulato",   tone: "bg-blue-500/15  text-blue-600  dark:text-blue-400 border-blue-500/30"  },
  queued:    { label: "In coda",      tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  blocked:   { label: "Bloccato",     tone: "bg-rose-500/15  text-rose-600  dark:text-rose-400 border-rose-500/30"  },
  draft:     { label: "Bozza",        tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};

export const TRIGGER_META: Record<CestinoTrigger, { label: string; Icon: typeof Megaphone; tone: string }> = {
  campaign:      { label: "Campagna",          Icon: Megaphone,    tone: "text-fuchsia-500" },
  inbound_reply: { label: "Risposta inbound",  Icon: ArrowUpRight, tone: "text-emerald-500" },
  mission:       { label: "Missione",          Icon: Bot,          tone: "text-cyan-500" },
  manual:        { label: "Manuale",           Icon: Pencil,       tone: "text-amber-500" },
  auto_touch:    { label: "Auto follow-up",    Icon: RefreshCw,    tone: "text-blue-500" },
  cockpit_draft: { label: "Bozza cockpit",     Icon: Bot,          tone: "text-slate-500" },
};

export const PARTNER_TYPE_META: Record<string, { label: string; tone: string }> = {
  wca_partner: { label: "Partner WCA", tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  customer:    { label: "Cliente",     tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  lead:        { label: "Lead",        tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  prospect:    { label: "Prospect",    tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};