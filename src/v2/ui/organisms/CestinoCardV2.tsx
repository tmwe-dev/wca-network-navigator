/**
 * CestinoCardV2 — scheda di lavoro completa per un item del Cestinone.
 *
 * Più alta della card v1: mostra header arricchito (canale, stato,
 * bandiera, agente AI, campagna), oggetto + destinatario tipizzato,
 * tabs interni (Anteprima / Destinatario / Origine / Storico) e
 * footer azioni (Conferma / Modifica / Snooze / Annulla / Vai all'origine).
 *
 * Editorial review intoccato: Conferma naviga al canale d'origine.
 */
import * as React from "react";
import { useState } from "react";
import DOMPurify from "dompurify";
import {
  Mail, MessageCircle, Linkedin, Phone,
  Trash2, Pencil, Clock, CheckCircle2, AlertOctagon,
  Bot, Megaphone, ArrowUpRight, Search, ExternalLink, Building2, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import type { CestinoItem, CestinoChannel, CestinoStatus, CestinoTrigger } from "@/data/cestinone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";

const CHANNEL_META: Record<CestinoChannel, { label: string; Icon: typeof Mail; tone: string; bg: string }> = {
  email:    { label: "Email",    Icon: Mail,          tone: "text-primary",          bg: "bg-primary/10" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, tone: "text-emerald-500",      bg: "bg-emerald-500/10" },
  linkedin: { label: "LinkedIn", Icon: Linkedin,      tone: "text-blue-500",         bg: "bg-blue-500/10" },
  voice:    { label: "Voce",     Icon: Phone,         tone: "text-orange-500",       bg: "bg-orange-500/10" },
  other:    { label: "Altro",    Icon: Mail,          tone: "text-muted-foreground", bg: "bg-muted" },
};

const STATUS_META: Record<CestinoStatus, { label: string; tone: string }> = {
  pending:   { label: "Da approvare", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  scheduled: { label: "Schedulato",   tone: "bg-blue-500/15  text-blue-600  dark:text-blue-400 border-blue-500/30"  },
  queued:    { label: "In coda",      tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  blocked:   { label: "Bloccato",     tone: "bg-rose-500/15  text-rose-600  dark:text-rose-400 border-rose-500/30"  },
  draft:     { label: "Bozza",        tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};

const TRIGGER_META: Record<CestinoTrigger, { label: string; Icon: typeof Megaphone }> = {
  campaign:      { label: "Campagna",          Icon: Megaphone },
  inbound_reply: { label: "Risposta inbound",  Icon: ArrowUpRight },
  mission:       { label: "Missione",          Icon: Bot },
  manual:        { label: "Manuale",           Icon: Pencil },
  auto_touch:    { label: "Auto follow-up",    Icon: RefreshCw },
  cockpit_draft: { label: "Bozza cockpit",     Icon: Bot },
};

const PARTNER_TYPE_META: Record<string, { label: string; tone: string }> = {
  wca_partner: { label: "Partner WCA", tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  customer:    { label: "Cliente",     tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  lead:        { label: "Lead",        tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  prospect:    { label: "Prospect",    tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

export interface CestinoCardV2Props {
  readonly item: CestinoItem;
  readonly onConfirm: () => void;
  readonly onEdit: () => void;
  readonly onSnooze: (minutes: number) => void;
  readonly onCancel: () => void;
  readonly onGotoOrigin: () => void;
  readonly onOpenPartner?: () => void;
  readonly onRunSherlock?: () => void;
}

export function CestinoCardV2({
  item, onConfirm, onEdit, onSnooze, onCancel, onGotoOrigin, onOpenPartner, onRunSherlock,
}: CestinoCardV2Props): React.ReactElement {
  const ch = CHANNEL_META[item.channel];
  const st = STATUS_META[item.status];
  const tr = TRIGGER_META[item.triggerKind];
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  const when = item.scheduledAt ?? item.createdAt;
  const ageLabel = item.scheduledAt
    ? `tra ${formatDistanceToNow(new Date(when), { locale: itLocale })}`
    : `${formatDistanceToNow(new Date(when), { locale: itLocale })} fa`;
  const canSnooze = item.source === "email_campaign_queue" || item.source === "campaign_jobs";

  const [tab, setTab] = useState("preview");

  return (
    <article className="rounded-lg border bg-card transition-colors hover:border-primary/40">
      {/* === HEADER RIGA 1 ============================== */}
      <header className="px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", ch.bg)}>
          <ch.Icon className={cn("h-5 w-5", ch.tone)} />
        </div>
        <Badge variant="outline" className={cn("text-[10px] font-medium border", st.tone)}>{st.label}</Badge>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{ch.label}</span>
        {flag && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={item.partnerCountryCode ?? ""}>
            <span className="text-base leading-none">{flag}</span>
            <span className="font-mono uppercase">{item.partnerCountryCode}</span>
          </span>
        )}
        {pt && (
          <Badge variant="secondary" className={cn("text-[10px] font-medium", pt.tone)}>
            {pt.label}{item.partnerWcaId ? ` #${item.partnerWcaId}` : ""}
          </Badge>
        )}
        {item.status === "blocked" && (
          <span className="flex items-center gap-1 text-[11px] text-rose-500">
            <AlertOctagon className="h-3 w-3" /> {item.lastError ?? "Bloccato"}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {ageLabel}
        </span>
      </header>

      {/* === HEADER RIGA 2 — contesto operativo ========= */}
      <div className="px-4 pb-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap border-b">
        <span className="flex items-center gap-1">
          <Bot className="h-3 w-3" />
          <span className="font-medium text-foreground/80">{item.agentName ?? "Operatore"}</span>
        </span>
        <span className="opacity-40">·</span>
        <span className="flex items-center gap-1">
          <tr.Icon className="h-3 w-3" />
          {tr.label}{item.campaignName ? `: "${item.campaignName}"` : ""}
        </span>
        <span className="ml-auto font-mono opacity-60">{item.id}</span>
      </div>

      {/* === CORPO ====================================== */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2">
          {item.subject ?? "(senza oggetto)"}
        </h3>
        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          {item.partnerName ? (
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground hover:underline"
              onClick={onOpenPartner}
              disabled={!onOpenPartner}
            >
              <Building2 className="h-3 w-3" />
              <span className="font-medium">{item.partnerName}</span>
            </button>
          ) : item.recipientName ? (
            <span>{item.recipientName}</span>
          ) : (
            <span className="opacity-50">—</span>
          )}
          {item.recipientHandle && (
            <>
              <span className="opacity-40">·</span>
              <span className="font-mono">{item.recipientHandle}</span>
            </>
          )}
          {item.retryCount > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-amber-600 dark:text-amber-400">↻ {item.retryCount}/{item.maxRetries}</span>
            </>
          )}
        </div>

        {/* === TABS interni =========================== */}
        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="text-xs h-6 px-2">Anteprima</TabsTrigger>
            <TabsTrigger value="recipient" className="text-xs h-6 px-2">Destinatario</TabsTrigger>
            <TabsTrigger value="origin" className="text-xs h-6 px-2">Origine</TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-6 px-2">Storico</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-2">
            <PreviewTab item={item} />
          </TabsContent>
          <TabsContent value="recipient" className="mt-2">
            <RecipientTab item={item} onOpenPartner={onOpenPartner} />
          </TabsContent>
          <TabsContent value="origin" className="mt-2">
            <OriginTab item={item} onRunSherlock={onRunSherlock} />
          </TabsContent>
          <TabsContent value="history" className="mt-2">
            <HistoryTab item={item} />
          </TabsContent>
        </Tabs>
      </div>

      {/* === FOOTER azioni ============================== */}
      <footer className="px-4 py-2 border-t bg-muted/20 flex items-center gap-2 flex-wrap">
        <Button size="sm" className="h-8 gap-1.5" onClick={onConfirm}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Conferma e invia
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Modifica
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5" disabled={!canSnooze}
              title={canSnooze ? "Rinvia" : "Snooze non disponibile per questa sorgente"}>
              <Clock className="h-3.5 w-3.5" /> Rinvia
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onSnooze(60)}>+1 ora</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(60 * 4)}>+4 ore</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(minutesUntilTomorrow9())}>Domani 09:00</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSnooze(minutesUntilNextMonday9())}>Lunedì 09:00</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive" onClick={onCancel}>
          <Trash2 className="h-3.5 w-3.5" /> Annulla
        </Button>

        <Button size="sm" variant="ghost" className="h-8 gap-1.5 ml-auto text-muted-foreground" onClick={onGotoOrigin}>
          <ExternalLink className="h-3.5 w-3.5" /> Vai all'origine
        </Button>
      </footer>
    </article>
  );
}

// ── Tabs ─────────────────────────────────────────────────

function PreviewTab({ item }: { item: CestinoItem }): React.ReactElement {
  if (item.bodyHtml) {
    return (
      <div
        className="text-xs prose prose-sm dark:prose-invert max-w-none border rounded-md p-3 bg-background max-h-[280px] overflow-y-auto"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.bodyHtml) }}
      />
    );
  }
  if (item.bodyText) {
    return (
      <pre className="text-xs whitespace-pre-wrap border rounded-md p-3 bg-background max-h-[280px] overflow-y-auto font-sans">
        {item.bodyText}
      </pre>
    );
  }
  if (item.preview) {
    return <p className="text-xs text-muted-foreground italic">{item.preview}</p>;
  }
  return <p className="text-xs text-muted-foreground italic">Nessuna anteprima disponibile per questo elemento.</p>;
}

function RecipientTab({ item, onOpenPartner }: { item: CestinoItem; onOpenPartner?: () => void }): React.ReactElement {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      <Field label="Azienda" value={item.partnerName ?? item.recipientName ?? "—"} />
      <Field label="Tipo" value={item.partnerType ? PARTNER_TYPE_META[item.partnerType]?.label : "—"} />
      <Field label="Paese" value={item.partnerCountryCode ?? "—"} />
      <Field label="Lead status" value={item.partnerLeadStatus ?? "—"} />
      <Field label="WCA ID" value={item.partnerWcaId ? `#${item.partnerWcaId}` : "—"} />
      <Field label="Canale" value={`${CHANNEL_META[item.channel].label} · ${item.recipientHandle ?? "—"}`} />
      {onOpenPartner && item.partnerId && (
        <div className="col-span-2 mt-1">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onOpenPartner}>
            <Building2 className="h-3 w-3" /> Apri scheda partner
          </Button>
        </div>
      )}
    </dl>
  );
}

function OriginTab({ item, onRunSherlock }: { item: CestinoItem; onRunSherlock?: () => void }): React.ReactElement {
  const tr = TRIGGER_META[item.triggerKind];
  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center gap-2 text-foreground">
        <tr.Icon className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{tr.label}</span>
        {item.campaignName && <span className="text-muted-foreground">— {item.campaignName}</span>}
      </div>
      <Field label="Agente AI" value={item.agentName ?? "—"} inline />
      <Field label="Sorgente coda" value={SOURCE_LABEL[item.source]} inline />
      <Field label="Creato" value={format(new Date(item.createdAt), "dd MMM yyyy HH:mm", { locale: itLocale })} inline />
      {item.scheduledAt && (
        <Field label="Schedulato" value={format(new Date(item.scheduledAt), "dd MMM yyyy HH:mm", { locale: itLocale })} inline />
      )}
      {item.lastError && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-rose-600 dark:text-rose-400">
          ⚠ {item.lastError}
        </div>
      )}

      {/* Deep search */}
      {item.partnerId && (
        item.deepSearchDoneAt ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            Deep search eseguita il {format(new Date(item.deepSearchDoneAt), "dd MMM yyyy", { locale: itLocale })}
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 text-amber-700 dark:text-amber-400">Nessuna deep search su questo partner.</span>
            {onRunSherlock && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={onRunSherlock}>
                Esegui Sherlock
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function HistoryTab({ item }: { item: CestinoItem }): React.ReactElement {
  // Timeline arricchita richiede DAL dedicato — qui placeholder informativo
  // così il tab è funzionale. La timeline reale verrà collegata in step 2.
  return (
    <p className="text-xs text-muted-foreground italic">
      Timeline interazioni con {item.partnerName ?? "questo destinatario"} disponibile dalla scheda partner.
    </p>
  );
}

const SOURCE_LABEL: Record<CestinoItem["source"], string> = {
  email_campaign_queue: "Coda email campagne",
  campaign_jobs: "Job campagna",
  cockpit_queue: "Cockpit",
  outreach_queue: "Outreach multicanale",
};

function Field({ label, value, inline }: { label: string; value: string | null | undefined; inline?: boolean }): React.ReactElement {
  if (inline) {
    return (
      <div className="flex gap-2">
        <span className="text-muted-foreground min-w-[110px]">{label}</span>
        <span className="text-foreground">{value ?? "—"}</span>
      </div>
    );
  }
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value ?? "—"}</dd>
    </>
  );
}

function minutesUntilTomorrow9(): number {
  const now = new Date();
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return Math.max(1, Math.round((t.getTime() - now.getTime()) / 60_000));
}
function minutesUntilNextMonday9(): number {
  const now = new Date();
  const t = new Date(now);
  const day = t.getDay(); // 0=sun
  const daysToMon = ((1 - day + 7) % 7) || 7;
  t.setDate(t.getDate() + daysToMon);
  t.setHours(9, 0, 0, 0);
  return Math.max(1, Math.round((t.getTime() - now.getTime()) / 60_000));
}

export default CestinoCardV2;