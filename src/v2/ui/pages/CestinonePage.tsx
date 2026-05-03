/**
 * CestinonePage — 2-column workspace:
 *   COL 1 — Lista cards ricche (1/3 schermo)
 *   COL 2 — Dettaglio: header ricco + tabs + footer azioni (2/3)
 */
import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import {
  CheckCircle2, Search, Mail, MessageCircle, Linkedin, Phone,
  Bot, Megaphone, ArrowUpRight, Pencil, RefreshCw, Clock, AlertOctagon,
  Trash2, Building2, Inbox, IdCard, ShieldCheck, MapPin, Calendar, History, Send, FileText, Sparkles,
  ExternalLink, User, Globe, Hash, ChevronDown, Rocket,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { useCestinone } from "@/v2/hooks/useCestinone";
import type { CestinoChannel, CestinoStatus, CestinoItem, CestinoTrigger } from "@/data/cestinone";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { resolveAgentAvatar } from "@/data/agentAvatars";

// ── AGENT BADGE ──────────────────────────────────────────
function AgentBadge({ name, size = "sm" }: { name: string; size?: "sm" | "md" }): React.ReactElement {
  const avatar = resolveAgentAvatar(name);
  const dim = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <Badge variant="secondary" className="text-[9px] gap-1 pl-0.5" title={`Agente: ${name}`}>
      {avatar ? (
        <img src={avatar} alt="" className={cn(dim, "rounded-full object-cover ring-1 ring-background")} />
      ) : (
        <Bot className={cn(dim)} />
      )}
      <span className="truncate max-w-[100px] capitalize">{name}</span>
    </Badge>
  );
}

// ── META ─────────────────────────────────────────────────

const CHANNEL_META: Record<CestinoChannel, {
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
const STATUS_META: Record<CestinoStatus, { label: string; tone: string }> = {
  pending:   { label: "Da approvare", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  scheduled: { label: "Schedulato",   tone: "bg-blue-500/15  text-blue-600  dark:text-blue-400 border-blue-500/30"  },
  queued:    { label: "In coda",      tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  blocked:   { label: "Bloccato",     tone: "bg-rose-500/15  text-rose-600  dark:text-rose-400 border-rose-500/30"  },
  draft:     { label: "Bozza",        tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};
const TRIGGER_META: Record<CestinoTrigger, { label: string; Icon: typeof Megaphone; tone: string }> = {
  campaign:      { label: "Campagna",          Icon: Megaphone,    tone: "text-fuchsia-500" },
  inbound_reply: { label: "Risposta inbound",  Icon: ArrowUpRight, tone: "text-emerald-500" },
  mission:       { label: "Missione",          Icon: Bot,          tone: "text-cyan-500" },
  manual:        { label: "Manuale",           Icon: Pencil,       tone: "text-amber-500" },
  auto_touch:    { label: "Auto follow-up",    Icon: RefreshCw,    tone: "text-blue-500" },
  cockpit_draft: { label: "Bozza cockpit",     Icon: Bot,          tone: "text-slate-500" },
};
const PARTNER_TYPE_META: Record<string, { label: string; tone: string }> = {
  wca_partner: { label: "Partner WCA", tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  customer:    { label: "Cliente",     tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  lead:        { label: "Lead",        tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  prospect:    { label: "Prospect",    tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};

// ── PAGE ─────────────────────────────────────────────────

export function CestinonePage(): React.ReactElement {
  const [channel, setChannel] = useState<CestinoChannel | "all">("all");
  // Solo 2 stati operativi: "pending" (da approvare) e "queued" (in coda, ingloba scheduled).
  const [status, setStatus] = useState<"pending" | "queued">("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());

  // Lo status lo applichiamo localmente per poter unire queued+scheduled.
  const { items: rawItems, counts, isLoading, cancel, snooze, dismiss } = useCestinone({ channel, status: "all", search });
  const items = useMemo(() => {
    const filtered = rawItems.filter((it) =>
      status === "pending"
        ? it.status === "pending"
        : it.status === "queued" || it.status === "scheduled"
    );
    if (status === "queued") {
      // Ordina per scheduledAt asc (le prime in partenza in cima).
      return [...filtered].sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    }
    return filtered;
  }, [rawItems, status]);

  // Pulisce le selezioni bulk quando gli item visibili cambiano (filtri/refetch).
  useEffect(() => {
    setBulkIds((prev) => {
      const visible = new Set(items.map((i) => i.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  function toggleBulk(id: string): void {
    setBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleBulkAll(): void {
    setBulkIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }
  function clearBulk(): void { setBulkIds(new Set()); }

  function handleBulkCancel(): void {
    const targets = items.filter((i) => bulkIds.has(i.id));
    if (targets.length === 0) return;
    if (!window.confirm(`Annullare e rimuovere dal cestinone ${targets.length} elemento/i?`)) return;
    let ok = 0, ko = 0;
    for (const it of targets) {
      dismiss(it.id);
      cancel.mutate(it, {
        onSuccess: () => { ok++; if (ok + ko === targets.length) toast.success(`${ok} annullati${ko ? ` · ${ko} falliti` : ""}`); },
        onError: () => { ko++; if (ok + ko === targets.length) toast.error(`${ok} annullati · ${ko} falliti`); },
      });
    }
    clearBulk();
  }
  function handleBulkSnooze(minutes: number): void {
    const targets = items.filter((i) => bulkIds.has(i.id));
    if (targets.length === 0) return;
    for (const it of targets) {
      dismiss(it.id);
      snooze.mutate({ item: it, minutes });
    }
    toast.success(`${targets.length} rinviati di ${minutes} min`);
    clearBulk();
  }
  const inCodaTotal = counts.byStatus.queued + counts.byStatus.scheduled;
  // I primi 3 item con scheduledAt valido sono "in partenza".
  const nextDepartingIds = useMemo(() => {
    if (status !== "queued") return new Set<string>();
    return new Set(items.filter((i) => !!i.scheduledAt).slice(0, 3).map((i) => i.id));
  }, [items, status]);
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

  function originHref(item: CestinoItem): string {
    const localId = item.id.split(":")[1] ?? "";
    if (item.source === "email_campaign_queue") return `/v2/communicate/outreach?queue=${encodeURIComponent(localId)}`;
    if (item.source === "campaign_jobs")       return `/v2/communicate/campaigns?job=${encodeURIComponent(localId)}`;
    if (item.source === "cockpit_queue")       return `/v2/communicate/outreach?cockpit=${encodeURIComponent(localId)}`;
    return `/v2/communicate/outreach?multi=${encodeURIComponent(localId)}`;
  }

  function handleConfirm(item: CestinoItem): void {
    dismiss(item.id);
    toast.success("Confermato. Apro l'origine per il send finale.");
    navigate(originHref(item));
  }

  function handleEdit(item: CestinoItem): void {
    if (item.partnerId) navigate(`/v2/communicate/compose?partner=${item.partnerId}`);
    else navigate("/v2/communicate/compose");
  }

  function handleOpenOrigin(item: CestinoItem): void {
    navigate(originHref(item));
  }

  function handleOpenPartner(item: CestinoItem): void {
    if (!item.partnerId) {
      toast.info("Nessun partner collegato a questa azione.");
      return;
    }
    openDrawer({ sourceType: "partner", sourceId: item.partnerId, title: item.partnerName ?? undefined });
  }

  function handleRunSherlock(item: CestinoItem): void {
    if (item.partnerId) {
      navigate(`/v2/sherlock?partner=${item.partnerId}`);
      toast.info("Apro Sherlock per la deep search.");
    }
  }

  function handleCancel(item: CestinoItem): void {
    dismiss(item.id);
    cancel.mutate(item, {
      onSuccess: () => toast.success("Annullato"),
      onError: (e) => toast.error("Annullamento fallito", { description: String(e) }),
    });
  }

  function handleSnooze(item: CestinoItem, minutes: number): void {
    dismiss(item.id);
    snooze.mutate({ item, minutes }, {
      onSuccess: () => toast.success(`Rinviato di ${minutes} min`),
      onError: (e) => toast.error("Snooze fallito", { description: String(e) }),
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 flex flex-wrap items-center gap-3 border-b bg-muted/20">
        <div className="flex items-baseline gap-2 mr-1">
          <h1 className="text-sm font-semibold leading-none">Cestinone</h1>
          <span className="text-[10px] text-muted-foreground hidden lg:inline">conferma, modifica o rinvia</span>
        </div>
        <ChipGroup
          value={status}
          onChange={(v) => setStatus(v as "pending" | "queued")}
          options={[
            { value: "pending",   label: `Da approvare (${counts.byStatus.pending})` },
            { value: "queued",    label: `In coda (${inCodaTotal})` },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <ChannelDropdown value={channel} onChange={setChannel} counts={counts} />
          <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca soggetto, destinatario..."
            className="h-8 pl-7 w-64 text-xs"
          />
          </div>
        </div>
      </div>

      {/* === BARRA AZIONI BULK ============================ */}
      {bulkIds.size > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 border-b bg-primary/5 text-xs">
          <Checkbox
            checked={bulkIds.size === items.length && items.length > 0}
            onCheckedChange={toggleBulkAll}
            aria-label="Seleziona tutti"
          />
          <span className="font-medium">{bulkIds.size} selezionati</span>
          <span className="text-muted-foreground hidden sm:inline">su {items.length}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => handleBulkSnooze(60)}>
              <Clock className="h-3 w-3" /> Rinvia 1h
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => handleBulkSnooze(60 * 24)}>
              <Clock className="h-3 w-3" /> Rinvia 24h
            </Button>
            <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs" onClick={handleBulkCancel}>
              <Trash2 className="h-3 w-3" /> Annulla {bulkIds.size}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearBulk}>Deseleziona</Button>
          </div>
        </div>
      )}

      {/* === 2-COLUMN LAYOUT ============================ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(340px,1fr)_minmax(560px,2fr)] overflow-hidden">

        {/* COL 1 — LISTA */}
        <div className="border-r overflow-y-auto p-2 space-y-2 bg-background">
          {items.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
              <Checkbox
                checked={items.length > 0 && bulkIds.size === items.length}
                onCheckedChange={toggleBulkAll}
                aria-label="Seleziona tutti i visibili"
              />
              <span>Seleziona tutti i {items.length} visibili</span>
            </div>
          )}
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
                departingSoon={nextDepartingIds.has(item.id)}
                checked={bulkIds.has(item.id)}
                onToggleCheck={() => toggleBulk(item.id)}
              />
            ))
          )}
        </div>

        {/* COL 2 — DETTAGLIO */}
        <div className="overflow-hidden bg-background flex flex-col">
          {selected ? (
            <DetailPanel
              item={selected}
              onConfirm={() => handleConfirm(selected)}
              onEdit={() => handleEdit(selected)}
              onOpenOrigin={() => handleOpenOrigin(selected)}
              onOpenPartner={() => handleOpenPartner(selected)}
              onRunSherlock={() => handleRunSherlock(selected)}
              onSnooze={(m) => handleSnooze(selected, m)}
              onCancel={() => handleCancel(selected)}
              canSnooze={selected.source === "email_campaign_queue" || selected.source === "campaign_jobs"}
            />
          ) : (
            <EmptyPane label="Seleziona una card per vedere il dettaglio." />
          )}
        </div>
      </div>
    </div>
  );
}

// ── ListRow (card alta, ricca) ─────────────────────────────

function ListRow({ item, selected, onSelect, departingSoon, checked, onToggleCheck }: { item: CestinoItem; selected: boolean; onSelect: () => void; departingSoon?: boolean; checked?: boolean; onToggleCheck?: () => void }): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const st = STATUS_META[item.status] ?? STATUS_META.pending;
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  const when = item.scheduledAt ?? item.createdAt;
  const ageLabel = item.scheduledAt
    ? `tra ${formatDistanceToNow(new Date(when), { locale: itLocale })}`
    : `${formatDistanceToNow(new Date(when), { locale: itLocale })} fa`;
  return (
    <div
      className={cn(
        "w-full text-left rounded-lg border border-l-4 bg-card p-3 transition-all hover:border-primary/40 hover:bg-accent/30",
        ch.borderL,
        selected && "border-primary ring-1 ring-primary/30 bg-accent/40",
        "flex gap-2"
      )}
    >
      {onToggleCheck && (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={!!checked} onCheckedChange={onToggleCheck} aria-label="Seleziona elemento" />
        </div>
      )}
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
      {/* Riga 1 — Titolo a sx + trigger badge a dx (campagna / AI / manuale) */}
      <div className="flex items-start gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight line-clamp-2">
            {item.subject ?? "(senza oggetto)"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.partnerName ?? item.recipientName ?? item.recipientHandle ?? "—"}</span>
          </div>
        </div>
        <span
          title={tr.label}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium",
            tr.tone, "border-current/30 bg-current/10"
          )}
        >
          <tr.Icon className="h-2.5 w-2.5" />
          <span className="hidden sm:inline">{tr.label}</span>
        </span>
      </div>

      {/* Riga 2 — Meta sinistra (canale icona, stato, lead, partner type) + bandiera a dx */}
      <div className="flex items-center gap-1.5 mt-2">
        <span title={ch.label} className="inline-flex"><ch.Icon className={cn("h-3.5 w-3.5 shrink-0", ch.tone)} /></span>
        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border", st.tone)}>{st.label}</Badge>
        {pt && (
          <span className={cn("px-1.5 py-0.5 rounded border font-medium text-[9px]", pt.tone)}>{pt.label}</span>
        )}
        {departingSoon && (
          <Badge className="text-[9px] px-1.5 py-0 gap-1 bg-primary/15 text-primary border border-primary/30">
            <Rocket className="h-2.5 w-2.5" /> in partenza
          </Badge>
        )}
        {item.status === "blocked" && <AlertOctagon className="h-3 w-3 text-rose-500" />}
        <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">{ageLabel}</span>
        {flag && <span className="text-base leading-none" title={item.partnerCountryCode ?? ""}>{flag}</span>}
      </div>
      </button>
    </div>
  );
}

// ── DetailPanel (header + tabs + footer) ─────────────────

interface DetailPanelProps {
  item: CestinoItem;
  onConfirm: () => void;
  onEdit: () => void;
  onOpenOrigin: () => void;
  onOpenPartner: () => void;
  onRunSherlock: () => void;
  onSnooze: (m: number) => void;
  onCancel: () => void;
  canSnooze: boolean;
}

function DetailPanel({
  item, onConfirm, onEdit, onOpenOrigin, onOpenPartner, onRunSherlock, onSnooze, onCancel, canSnooze,
}: DetailPanelProps): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const st = STATUS_META[item.status] ?? STATUS_META.pending;
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";

  return (
    <>
      {/* === HEADER COMPATTO (1 blocco, allineato a sx) === */}
      <div className={cn("border-b border-l-4 px-4 py-2.5 bg-muted/10", ch.borderL)}>
        {/* Riga 1: titolo a sx + canale/stato/trigger a dx */}
        <div className="flex items-start gap-3 mb-1.5">
          <h2 className="flex-1 min-w-0 text-base font-semibold leading-snug text-left line-clamp-2">
            {item.subject ?? "(senza oggetto)"}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <span title={ch.label} className={cn("h-6 w-6 rounded-md flex items-center justify-center", ch.bg)}>
              <ch.Icon className={cn("h-3.5 w-3.5", ch.tone)} />
            </span>
            <Badge variant="outline" className={cn("text-[9px] border", st.tone)}>{st.label}</Badge>
            <span title={tr.label} className={cn("flex items-center", tr.tone)}>
              <tr.Icon className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Riga 2: partner + bandiera + meta */}
        <div className="flex items-center gap-2 flex-wrap text-left">
          <span className="text-sm font-medium truncate max-w-[260px]">
            {item.partnerName ?? item.recipientName ?? "—"}
          </span>
          {flag && <span className="text-base leading-none" title={item.partnerCountryCode ?? ""}>{flag}</span>}
          {pt && <Badge variant="outline" className={cn("text-[9px] border", pt.tone)}>{pt.label}</Badge>}
          {item.partnerLeadStatus && (
            <Badge variant="outline" className="text-[9px]">Lead: {item.partnerLeadStatus}</Badge>
          )}
          {item.partnerWcaId && (
            <Badge variant="outline" className="text-[9px] gap-1">
              <Hash className="h-2.5 w-2.5" />WCA #{item.partnerWcaId}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground truncate ml-1">
            → {item.recipientHandle ?? "—"}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {item.campaignName && (
              <Badge variant="secondary" className="text-[9px] gap-1" title={item.campaignName}>
                <Megaphone className="h-2.5 w-2.5" />
                <span className="truncate max-w-[120px]">{item.campaignName}</span>
              </Badge>
            )}
            {item.agentName && (
              <AgentBadge name={item.agentName} />
            )}
          </div>
        </div>
      </div>

      {/* === TABS === */}
      <Tabs defaultValue="preview" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-3 mt-2 self-start">
          <TabsTrigger value="preview" className="text-xs gap-1.5">
            <Mail className="h-3 w-3" /> Anteprima
          </TabsTrigger>
          <TabsTrigger value="origin" className="text-xs gap-1.5">
            <Sparkles className="h-3 w-3" /> Origine
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5">
            <History className="h-3 w-3" /> Storico
          </TabsTrigger>
          <TabsTrigger value="checks" className="text-xs gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Controlli
          </TabsTrigger>
          <TabsTrigger value="recipient" className="text-xs gap-1.5">
            <User className="h-3 w-3" /> Destinatario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <PreviewTab item={item} />
        </TabsContent>
        <TabsContent value="origin" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <OriginTab item={item} onOpenOrigin={onOpenOrigin} />
        </TabsContent>
        <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <HistoryTab item={item} />
        </TabsContent>
        <TabsContent value="checks" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <ChecksTab item={item} onRunSherlock={onRunSherlock} />
        </TabsContent>
        <TabsContent value="recipient" className="flex-1 min-h-0 overflow-y-auto px-4 py-3 m-0">
          <RecipientTab item={item} onOpenPartner={onOpenPartner} />
        </TabsContent>
      </Tabs>

      {/* === FOOTER AZIONI === */}
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
        <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={onOpenOrigin}>
          <ExternalLink className="h-3.5 w-3.5" /> Apri origine
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive ml-auto" onClick={onCancel}>
          <Trash2 className="h-3.5 w-3.5" /> Annulla
        </Button>
      </footer>
    </>
  );
}

// ── TABS ─────────────────────────────────────────────────

function PreviewTab({ item }: { item: CestinoItem }): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const isLinkedIn = item.channel === "linkedin";
  const charCount = (item.bodyText ?? "").length;
  const limit = isLinkedIn ? 300 : null;

  return (
    <div className="space-y-3">
      {/* Header email-style */}
      {item.channel === "email" && (
        <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-1">
          <div className="flex gap-2"><span className="text-muted-foreground w-12 shrink-0">A:</span><span className="font-medium truncate">{item.recipientHandle ?? "—"}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-12 shrink-0">Oggetto:</span><span className="font-medium">{item.subject ?? "—"}</span></div>
        </div>
      )}
      {(item.channel === "whatsapp" || item.channel === "linkedin") && (
        <div className="flex items-center gap-2 text-xs">
          <ch.Icon className={cn("h-3.5 w-3.5", ch.tone)} />
          <span className="text-muted-foreground">a</span>
          <span className="font-medium">{item.recipientHandle ?? "—"}</span>
          {limit && (
            <span className={cn("ml-auto text-[10px]", charCount > limit ? "text-rose-500" : "text-muted-foreground")}>
              {charCount}/{limit} caratteri
            </span>
          )}
        </div>
      )}

      {/* Body */}
      {item.bodyHtml ? (
        <div
          className="text-sm prose prose-sm dark:prose-invert max-w-none rounded-md border bg-background p-4"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.bodyHtml) }}
        />
      ) : item.bodyText ? (
        <pre className="text-sm whitespace-pre-wrap font-sans rounded-md border bg-background p-4">{item.bodyText}</pre>
      ) : item.preview ? (
        <p className="text-sm text-muted-foreground italic rounded-md border bg-background p-4">{item.preview}</p>
      ) : (
        <div className="text-sm text-muted-foreground italic rounded-md border border-dashed p-6 text-center">
          Nessuna anteprima disponibile per questa azione.
        </div>
      )}
    </div>
  );
}

function OriginTab({ item, onOpenOrigin }: { item: CestinoItem; onOpenOrigin: () => void }): React.ReactElement {
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const oc = item.originContext;
  const ORIGIN_ICON: Record<string, typeof Mail> = {
    business_card: IdCard,
    campaign: Megaphone,
    inbound_reply: ArrowUpRight,
    manual: Pencil,
    import: FileText,
    unknown: Bot,
  };
  const OriginIcon = ORIGIN_ICON[oc.source] ?? Bot;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-muted", tr.tone)}>
            <OriginIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Perché stiamo scrivendo</div>
            <div className="text-sm font-semibold mt-0.5">{tr.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{oc.label}</div>
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onOpenOrigin}>
            <ExternalLink className="h-3 w-3" /> Apri origine
          </Button>
        </div>

        {item.campaignName && (
          <div className="flex items-center gap-2 text-xs border-t pt-3">
            <Megaphone className="h-3.5 w-3.5 text-fuchsia-500" />
            <span className="text-muted-foreground">Campagna:</span>
            <span className="font-medium">{item.campaignName}</span>
          </div>
        )}

        {oc.source === "business_card" && (
          <div className="space-y-1.5 text-xs border-l-2 border-primary/40 pl-3 mt-2">
            {oc.eventName && <div className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> {oc.eventName}</div>}
            {oc.meetingLocation && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {oc.meetingLocation}</div>}
            {oc.acquiredAt && <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Incontrato il {format(new Date(oc.acquiredAt), "dd MMM yyyy", { locale: itLocale })}</div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t pt-3">
          <div className="text-muted-foreground">Agente AI</div>
          <div className="font-medium truncate flex items-center gap-1.5">
            {item.agentName ? (
              <>
                {(() => {
                  const av = resolveAgentAvatar(item.agentName);
                  return av
                    ? <img src={av} alt="" className="h-4 w-4 rounded-full object-cover ring-1 ring-background" />
                    : <Bot className="h-3.5 w-3.5 text-muted-foreground" />;
                })()}
                <span className="capitalize truncate">{item.agentName}</span>
              </>
            ) : "—"}
          </div>
          <div className="text-muted-foreground">Creato</div>
          <div>{format(new Date(item.createdAt), "dd MMM yyyy HH:mm", { locale: itLocale })}</div>
          {item.scheduledAt && <>
            <div className="text-muted-foreground">Schedulato</div>
            <div>{format(new Date(item.scheduledAt), "dd MMM yyyy HH:mm", { locale: itLocale })}</div>
          </>}
        </div>
      </div>

      {/* Messaggio originale (per inbound_reply) */}
      {item.previousMessage && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            <span>Messaggio originale a cui stiamo rispondendo</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {format(new Date(item.previousMessage.date), "dd MMM yyyy HH:mm", { locale: itLocale })}
            </span>
          </div>
          {item.previousMessage.subject && (
            <div className="text-sm font-medium">{item.previousMessage.subject}</div>
          )}
          {item.previousMessage.snippet && (
            <blockquote className="text-xs text-muted-foreground border-l-4 border-emerald-500/40 pl-3 py-1 italic whitespace-pre-wrap">
              {item.previousMessage.snippet}
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ item }: { item: CestinoItem }): React.ReactElement {
  if (item.recentInteractions.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground italic">
        Nessuna interazione registrata.<br />
        Sarebbe il primo contatto con questo destinatario.
      </div>
    );
  }
  return (
    <ol className="relative border-l-2 border-border ml-2 space-y-3">
      {item.recentInteractions.map((i, idx) => (
        <li key={idx} className="ml-4 pb-1">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
          <div className="flex items-center gap-2 text-xs mb-1">
            <Send className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium uppercase text-[10px] tracking-wide">{i.channel}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border text-muted-foreground">{i.direction === "in" ? "in" : i.direction === "out" ? "out" : "nota"}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {i.date ? format(new Date(i.date), "dd MMM yyyy", { locale: itLocale }) : ""}
            </span>
          </div>
          {i.subject && <div className="text-sm font-medium truncate">{i.subject}</div>}
          {i.snippet && <div className="text-xs text-muted-foreground line-clamp-2">{i.snippet}</div>}
        </li>
      ))}
    </ol>
  );
}

function ChecksTab({ item, onRunSherlock }: { item: CestinoItem; onRunSherlock: () => void }): React.ReactElement {
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Controlli pre-invio
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CheckRow ok={!!item.partnerId} label="Partner CRM collegato" />
          <CheckRow ok={!!item.deepSearchDoneAt} label="Deep Search Sherlock" detail={item.deepSearchDoneAt ? `Fatta ${format(new Date(item.deepSearchDoneAt), "dd MMM", { locale: itLocale })}` : "Mai eseguita"} />
          <CheckRow ok={!!item.agentName} label="Agente AI assegnato" detail={item.agentName ?? undefined} />
          <CheckRow ok label="Editorial review" detail="Obbligatoria all'invio" />
          <CheckRow ok={item.triggerKind === "campaign" || item.triggerKind === "inbound_reply"} label={`Routing: ${tr.label}`} />
          <CheckRow
            ok={item.retryCount === 0}
            warn={item.retryCount > 0 && item.retryCount < item.maxRetries}
            label={`Tentativi ${item.retryCount}/${item.maxRetries}`}
          />
        </div>

        {item.partnerId && !item.deepSearchDoneAt && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs w-full mt-2" onClick={onRunSherlock}>
            <Search className="h-3.5 w-3.5" /> Esegui Deep Search Sherlock prima di inviare
          </Button>
        )}
      </div>

      {item.lastError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-rose-600 dark:text-rose-400 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertOctagon className="h-3.5 w-3.5" /> Ultimo errore
          </div>
          <div>{item.lastError}</div>
        </div>
      )}
    </div>
  );
}

function RecipientTab({ item, onOpenPartner }: { item: CestinoItem; onOpenPartner: () => void }): React.ReactElement {
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          {flag && <span className="text-4xl leading-none">{flag}</span>}
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold truncate">{item.partnerName ?? item.recipientName ?? "—"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Globe className="h-3 w-3" />
              {item.partnerCountryName ?? item.partnerCountryCode ?? "Paese sconosciuto"}
              {item.partnerWcaId && <span> · WCA #{item.partnerWcaId}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pt && <Badge variant="outline" className={cn("text-[10px] border", pt.tone)}>{pt.label}</Badge>}
          {item.partnerLeadStatus && (
            <Badge variant="outline" className="text-[10px]">Lead status: {item.partnerLeadStatus}</Badge>
          )}
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-y-1.5 text-xs border-t pt-3">
          <div className="text-muted-foreground">Canale</div>
          <div className="font-medium">{CHANNEL_META[item.channel].label}</div>
          <div className="text-muted-foreground">Indirizzo</div>
          <div className="font-medium truncate">{item.recipientHandle ?? "—"}</div>
        </div>

        {item.partnerId && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs w-full" onClick={onOpenPartner}>
            <Building2 className="h-3.5 w-3.5" /> Apri scheda partner completa
          </Button>
        )}
      </div>
    </div>
  );
}

function CheckRow({ ok, warn, label, detail }: { ok: boolean; warn?: boolean; label: string; detail?: string }): React.ReactElement {
  const tone = warn
    ? "text-amber-600 dark:text-amber-400"
    : ok
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-muted-foreground";
  const Icon = ok && !warn ? CheckCircle2 : AlertOctagon;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", tone)} />
      <div className="min-w-0">
        <div className={cn("font-medium", tone)}>{label}</div>
        {detail && <div className="text-[10px] text-muted-foreground truncate">{detail}</div>}
      </div>
    </div>
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
              ? "bg-card/60 dark:bg-card/40 border-primary text-primary ring-1 ring-primary/30"
              : "bg-background text-muted-foreground border-border hover:bg-accent"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChannelDropdown({
  value, onChange, counts,
}: {
  value: CestinoChannel | "all";
  onChange: (v: CestinoChannel | "all") => void;
  counts: { total: number; byChannel: { email: number; whatsapp: number; linkedin: number } };
}): React.ReactElement {
  const opts: ReadonlyArray<{ v: CestinoChannel | "all"; label: string; Icon: typeof Mail; tone: string; count: number }> = [
    { v: "all",      label: "Tutti i canali", Icon: Inbox,         tone: "text-foreground",     count: counts.total },
    { v: "email",    label: "Email",          Icon: Mail,          tone: "text-violet-500",     count: counts.byChannel.email },
    { v: "whatsapp", label: "WhatsApp",       Icon: MessageCircle, tone: "text-emerald-500",    count: counts.byChannel.whatsapp },
    { v: "linkedin", label: "LinkedIn",       Icon: Linkedin,      tone: "text-sky-500",        count: counts.byChannel.linkedin },
  ];
  const current = opts.find((o) => o.v === value) ?? opts[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <current.Icon className={cn("h-3.5 w-3.5", current.tone)} />
          <span>{current.label}</span>
          <span className="text-muted-foreground">({current.count})</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {opts.map((o) => (
          <DropdownMenuItem key={o.v} onClick={() => onChange(o.v)} className="text-xs gap-2">
            <o.Icon className={cn("h-3.5 w-3.5", o.tone)} />
            <span className="flex-1">{o.label}</span>
            <span className="text-muted-foreground">{o.count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
