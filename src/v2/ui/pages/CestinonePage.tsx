/**
 * CestinonePage — 3-column workspace:
 *   COL 1 — Lista cards (1/3 schermo)
 *   COL 2 — Contesto (Destinatario / Origine / Dettagli)
 *   COL 3 — Anteprima messaggio + azioni (Conferma sparisce subito)
 */
import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import {
  CheckCircle2, Search, Mail, MessageCircle, Linkedin, Phone,
  Bot, Megaphone, ArrowUpRight, Pencil, RefreshCw, Clock, AlertOctagon,
  Trash2, Building2, Inbox, IdCard, ShieldCheck, MapPin, Calendar, History, Send, FileText, Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { useCestinone } from "@/v2/hooks/useCestinone";
import type { CestinoChannel, CestinoStatus, CestinoItem, CestinoTrigger } from "@/data/cestinone";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";

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
const SOURCE_LABEL: Record<CestinoItem["source"], string> = {
  email_campaign_queue: "Coda email campagne",
  campaign_jobs: "Job campagna",
  cockpit_queue: "Cockpit",
  outreach_queue: "Outreach multicanale",
};

export function CestinonePage(): React.ReactElement {
  const [channel, setChannel] = useState<CestinoChannel | "all">("all");
  const [status, setStatus] = useState<CestinoStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { items, counts, isLoading, cancel, snooze, dismiss } = useCestinone({ channel, status, search });
  const navigate = useNavigate();
  const { open: openDrawer } = useContactDrawer();

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    if ((!selectedId || !items.find((i) => i.id === selectedId)) && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  function handleConfirm(item: CestinoItem) {
    dismiss(item.id);
    toast.success("Confermato. Apro l'origine per il send finale.");
    if (item.source === "email_campaign_queue") {
      navigate(`/v2/communicate/outreach?queue=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
      return;
    }
    if (item.source === "campaign_jobs") {
      navigate(`/v2/communicate/campaigns?job=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
      return;
    }
    if (item.source === "cockpit_queue") {
      navigate(`/v2/communicate/outreach?cockpit=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
      return;
    }
    navigate(`/v2/communicate/outreach?multi=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
  }

  function handleEdit(item: CestinoItem) {
    if (item.partnerId) navigate(`/v2/communicate/compose?partner=${item.partnerId}`);
    else navigate("/v2/communicate/compose");
  }

  function handleOpenPartner(item: CestinoItem) {
    if (!item.partnerId) {
      toast.info("Nessun partner collegato a questa azione.");
      return;
    }
    openDrawer({ sourceType: "partner", sourceId: item.partnerId, title: item.partnerName ?? undefined });
  }

  function handleRunSherlock(item: CestinoItem) {
    if (item.partnerId) {
      navigate(`/v2/sherlock?partner=${item.partnerId}`);
      toast.info("Apro Sherlock per la deep search.");
    }
  }

  function handleCancel(item: CestinoItem) {
    dismiss(item.id);
    cancel.mutate(item, {
      onSuccess: () => toast.success("Annullato"),
      onError: (e) => toast.error("Annullamento fallito", { description: String(e) }),
    });
  }

  function handleSnooze(item: CestinoItem, minutes: number) {
    dismiss(item.id);
    snooze.mutate({ item, minutes }, {
      onSuccess: () => toast.success(`Rinviato di ${minutes} min`),
      onError: (e) => toast.error("Snooze fallito", { description: String(e) }),
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Cestinone</h1>
        <p className="text-xs text-muted-foreground">
          Lista a sinistra · Contesto al centro · Anteprima a destra. Conferma o annulla: la card sparisce subito dalla coda.
        </p>
      </header>

      <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b bg-muted/20">
        <ChipGroup
          value={channel}
          onChange={(v) => setChannel(v as CestinoChannel | "all")}
          options={[
            { value: "all",      label: `Tutti (${counts.total})` },
            { value: "email",    label: `Email (${counts.byChannel.email})` },
            { value: "whatsapp", label: `WA (${counts.byChannel.whatsapp})` },
            { value: "linkedin", label: `LinkedIn (${counts.byChannel.linkedin})` },
          ]}
        />
        <span className="text-muted-foreground/40">·</span>
        <ChipGroup
          value={status}
          onChange={(v) => setStatus(v as CestinoStatus | "all")}
          options={[
            { value: "all",       label: "Tutti" },
            { value: "pending",   label: `Da approvare (${counts.byStatus.pending})` },
            { value: "scheduled", label: `Schedulato (${counts.byStatus.scheduled})` },
            { value: "queued",    label: `In coda (${counts.byStatus.queued})` },
            { value: "blocked",   label: `Bloccato (${counts.byStatus.blocked})` },
          ]}
        />
        <div className="ml-auto relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca soggetto, destinatario..."
            className="h-8 pl-7 w-64 text-xs"
          />
        </div>
      </div>

      {/* === 3-COLUMN LAYOUT ============================ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(280px,1fr)_minmax(280px,1.1fr)_minmax(360px,1.6fr)] overflow-hidden">

        {/* COL 1 — LISTA */}
        <div className="border-r overflow-y-auto p-2 space-y-2 bg-background">
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-6 text-center">Carico...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-16 px-4 text-center">
              <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-500/60" />
              <div className="text-sm">Cestinone vuoto.</div>
            </div>
          ) : (
            items.map((item) => (
              <ListRow
                key={item.id}
                item={item}
                selected={item.id === selected?.id}
                onSelect={() => setSelectedId(item.id)}
              />
            ))
          )}
        </div>

        {/* COL 2 — CONTESTO */}
        <div className="border-r overflow-y-auto bg-muted/10">
          {selected ? (
            <ContextPanel
              item={selected}
              onOpenPartner={() => handleOpenPartner(selected)}
              onRunSherlock={() => handleRunSherlock(selected)}
            />
          ) : (
            <EmptyPane label="Seleziona una card per vedere il contesto." />
          )}
        </div>

        {/* COL 3 — ANTEPRIMA + AZIONI */}
        <div className="overflow-hidden bg-background flex flex-col">
          {selected ? (
            <PreviewPanel
              item={selected}
              onConfirm={() => handleConfirm(selected)}
              onEdit={() => handleEdit(selected)}
              onSnooze={(m) => handleSnooze(selected, m)}
              onCancel={() => handleCancel(selected)}
              canSnooze={selected.source === "email_campaign_queue" || selected.source === "campaign_jobs"}
            />
          ) : (
            <EmptyPane label="Seleziona una card per leggere e confermare." />
          )}
        </div>
      </div>
    </div>
  );
}

// ── ListRow (col 1) ──────────────────────────────────────

function ListRow({ item, selected, onSelect }: { item: CestinoItem; selected: boolean; onSelect: () => void }): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const st = STATUS_META[item.status] ?? STATUS_META.pending;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  const when = item.scheduledAt ?? item.createdAt;
  const ageLabel = item.scheduledAt
    ? `tra ${formatDistanceToNow(new Date(when), { locale: itLocale })}`
    : `${formatDistanceToNow(new Date(when), { locale: itLocale })} fa`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-2.5 transition-all hover:border-primary/40 hover:bg-accent/30",
        selected && "border-primary ring-1 ring-primary/30 bg-accent/40"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", ch.bg)}>
          <ch.Icon className={cn("h-3.5 w-3.5", ch.tone)} />
        </div>
        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border", st.tone)}>{st.label}</Badge>
        {flag && <span className="text-base leading-none" title={item.partnerCountryCode ?? ""}>{flag}</span>}
        {item.status === "blocked" && <AlertOctagon className="h-3 w-3 text-rose-500" />}
        <span className="ml-auto text-[10px] text-muted-foreground">{ageLabel}</span>
      </div>
      <div className="text-sm font-medium leading-tight line-clamp-2">{item.subject ?? "(senza oggetto)"}</div>
      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
        {item.partnerName ?? item.recipientName ?? item.recipientHandle ?? "—"}
      </div>
    </button>
  );
}

// ── ContextPanel (col 2) ─────────────────────────────────

function ContextPanel({ item, onOpenPartner, onRunSherlock }: { item: CestinoItem; onOpenPartner: () => void; onRunSherlock: () => void }): React.ReactElement {
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  return (
    <div className="p-4">
      <Tabs defaultValue="recipient" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="recipient" className="text-xs h-6">Destinatario</TabsTrigger>
          <TabsTrigger value="origin" className="text-xs h-6">Origine</TabsTrigger>
          <TabsTrigger value="meta" className="text-xs h-6">Dettagli</TabsTrigger>
        </TabsList>

        <TabsContent value="recipient" className="mt-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            {flag && <span className="text-2xl leading-none">{flag}</span>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{item.partnerName ?? item.recipientName ?? "—"}</div>
              {pt && <Badge variant="secondary" className={cn("text-[9px] mt-0.5", pt.tone)}>
                {pt.label}{item.partnerWcaId ? ` #${item.partnerWcaId}` : ""}
              </Badge>}
            </div>
          </div>
          <Field label="Paese" value={item.partnerCountryCode ?? "—"} />
          <Field label="Lead status" value={item.partnerLeadStatus ?? "—"} />
          <Field label="Canale" value={(CHANNEL_META[item.channel] ?? CHANNEL_META.other).label} />
          <Field label="Handle" value={item.recipientHandle ?? "—"} />
          {item.partnerId && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs w-full mt-2" onClick={onOpenPartner}>
              <Building2 className="h-3 w-3" /> Apri scheda partner
            </Button>
          )}
        </TabsContent>

        <TabsContent value="origin" className="mt-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-foreground">
            <tr.Icon className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{tr.label}</span>
            {item.campaignName && <span className="text-muted-foreground truncate">— {item.campaignName}</span>}
          </div>
          <Field label="Agente AI" value={item.agentName ?? "—"} />
          <Field label="Sorgente" value={SOURCE_LABEL[item.source]} />
          <Field label="Creato" value={format(new Date(item.createdAt), "dd MMM yyyy HH:mm", { locale: itLocale })} />
          {item.scheduledAt && <Field label="Schedulato" value={format(new Date(item.scheduledAt), "dd MMM yyyy HH:mm", { locale: itLocale })} />}

          {item.partnerId && (
            item.deepSearchDoneAt ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mt-2">
                <Search className="h-3.5 w-3.5" />
                <span className="text-[11px]">Deep search: {format(new Date(item.deepSearchDoneAt), "dd MMM yyyy", { locale: itLocale })}</span>
              </div>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 mt-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-[11px] mb-1.5">
                  <Search className="h-3.5 w-3.5" />
                  Nessuna deep search su questo partner.
                </div>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] w-full" onClick={onRunSherlock}>
                  Esegui Sherlock
                </Button>
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="meta" className="mt-3 space-y-2 text-xs">
          <Field label="ID coda" value={item.id} />
          <Field label="Partner ID" value={item.partnerId ?? "—"} />
          <Field label="Tentativi" value={`${item.retryCount}/${item.maxRetries}`} />
          {item.lastError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-rose-600 dark:text-rose-400 text-[11px]">
              ⚠ {item.lastError}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── PreviewPanel (col 3) ─────────────────────────────────

function PreviewPanel({ item, onConfirm, onEdit, onSnooze, onCancel, canSnooze }: {
  item: CestinoItem;
  onConfirm: () => void;
  onEdit: () => void;
  onSnooze: (m: number) => void;
  onCancel: () => void;
  canSnooze: boolean;
}): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  return (
    <>
      <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
        <ch.Icon className={cn("h-4 w-4", ch.tone)} />
        <h2 className="text-sm font-semibold truncate flex-1">{item.subject ?? "(senza oggetto)"}</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {item.bodyHtml ? (
          <div
            className="text-xs prose prose-sm dark:prose-invert max-w-none"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.bodyHtml) }}
          />
        ) : item.bodyText ? (
          <pre className="text-xs whitespace-pre-wrap font-sans">{item.bodyText}</pre>
        ) : item.preview ? (
          <p className="text-xs text-muted-foreground italic">{item.preview}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nessuna anteprima disponibile.</p>
        )}
      </div>
      <footer className="px-3 py-2 border-t bg-muted/20 flex items-center gap-1.5 flex-wrap shrink-0">
        <Button size="sm" className="h-8 gap-1.5" onClick={onConfirm}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Conferma
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Modifica
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5" disabled={!canSnooze}
              title={canSnooze ? "Rinvia" : "Snooze non disponibile"}>
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
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive ml-auto" onClick={onCancel}>
          <Trash2 className="h-3.5 w-3.5" /> Annulla
        </Button>
      </footer>
    </>
  );
}

function EmptyPane({ label }: { label: string }): React.ReactElement {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
      <Inbox className="h-10 w-10 mb-2 opacity-40" />
      <div className="text-xs">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[100px]">{label}</span>
      <span className="text-foreground truncate flex-1">{value}</span>
    </div>
  );
}

interface ChipGroupProps {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly options: ReadonlyArray<{ value: string; label: string }>;
}
function ChipGroup({ value, onChange, options }: ChipGroupProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:bg-accent"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
  const day = t.getDay();
  const daysToMon = ((1 - day + 7) % 7) || 7;
  t.setDate(t.getDate() + daysToMon);
  t.setHours(9, 0, 0, 0);
  return Math.max(1, Math.round((t.getTime() - now.getTime()) / 60_000));
}

export default CestinonePage;
