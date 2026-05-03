/**
 * CestinonePage — coda unica delle azioni in attesa di conferma/invio.
 *
 * Aggrega: email_campaign_queue, campaign_jobs, cockpit_queue, outreach_queue.
 * Conferma e Modifica indirizzano alle pagine canale già esistenti
 * (editorial review intoccato). Annulla/Rinvia agiscono qui.
 */
import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, MessageCircle, Linkedin, Phone, Trash2, Pencil, Clock, CheckCircle2, AlertOctagon, Search } from "lucide-react";
import { useCestinone } from "@/v2/hooks/useCestinone";
import type { CestinoChannel, CestinoStatus, CestinoItem } from "@/data/cestinone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { toast } from "sonner";

const CHANNEL_META: Record<CestinoChannel, { label: string; Icon: typeof Mail; tone: string }> = {
  email:    { label: "Email",    Icon: Mail,          tone: "text-primary" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, tone: "text-emerald-500" },
  linkedin: { label: "LinkedIn", Icon: Linkedin,      tone: "text-blue-500" },
  voice:    { label: "Voce",     Icon: Phone,         tone: "text-orange-500" },
  other:    { label: "Altro",    Icon: Mail,          tone: "text-muted-foreground" },
};

const STATUS_META: Record<CestinoStatus, { label: string; tone: string }> = {
  pending:   { label: "Da approvare", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  scheduled: { label: "Schedulato",   tone: "bg-blue-500/15  text-blue-600  dark:text-blue-400"  },
  queued:    { label: "In coda",      tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  blocked:   { label: "Bloccato",     tone: "bg-rose-500/15  text-rose-600  dark:text-rose-400"  },
  draft:     { label: "Bozza",        tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

export function CestinonePage(): React.ReactElement {
  const [channel, setChannel] = useState<CestinoChannel | "all">("all");
  const [status, setStatus] = useState<CestinoStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { items, counts, isLoading, cancel, snooze } = useCestinone({ channel, status, search });
  const navigate = useNavigate();

  function handleConfirm(item: CestinoItem) {
    // La conferma passa SEMPRE dal canale di origine — niente bypass editorial review.
    if (item.source === "email_campaign_queue") {
      navigate("/v2/communicate/outreach");
      toast.info("Apro la coda email per conferma manuale.");
      return;
    }
    if (item.source === "campaign_jobs") {
      navigate("/v2/campaigns/jobs");
      toast.info("Apro i campaign jobs.");
      return;
    }
    if (item.source === "cockpit_queue") {
      navigate("/v2/communicate/outreach");
      toast.info("Apro il cockpit.");
      return;
    }
    navigate("/v2/communicate/outreach");
  }

  function handleEdit(item: CestinoItem) {
    if (item.partnerId) navigate(`/v2/communicate/compose?partner=${item.partnerId}`);
    else navigate("/v2/communicate/compose");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Cestinone</h1>
        <p className="text-xs text-muted-foreground">
          Tutto ciò che è in cottura: bozze, code email, job campagne, attività in attesa.
          Conferma, modifica, rinvia o annulla — tutto da qui.
        </p>
      </header>

      <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b bg-muted/20">
        {/* Canale */}
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
        {/* Stato */}
        <ChipGroup
          value={status}
          onChange={(v) => setStatus(v as CestinoStatus | "all")}
          options={[
            { value: "all",       label: "Tutti gli stati" },
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

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-6 text-center">Carico...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-16">
            <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-500/60" />
            <div className="text-sm">Cestinone vuoto. Non c'è niente in attesa.</div>
          </div>
        ) : (
          items.map((item) => (
            <CestinoCard
              key={item.id}
              item={item}
              onConfirm={() => handleConfirm(item)}
              onEdit={() => handleEdit(item)}
              onSnooze={() => snooze.mutate({ item, minutes: 60 }, {
                onSuccess: () => toast.success("Rinviato di 1 ora"),
                onError: (e) => toast.error("Snooze fallito", { description: String(e) }),
              })}
              onCancel={() => cancel.mutate(item, {
                onSuccess: () => toast.success("Annullato"),
                onError: (e) => toast.error("Annullamento fallito", { description: String(e) }),
              })}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CestinoCardProps {
  readonly item: CestinoItem;
  readonly onConfirm: () => void;
  readonly onEdit: () => void;
  readonly onSnooze: () => void;
  readonly onCancel: () => void;
}

function CestinoCard({ item, onConfirm, onEdit, onSnooze, onCancel }: CestinoCardProps): React.ReactElement {
  const ch = CHANNEL_META[item.channel];
  const st = STATUS_META[item.status];
  const when = item.scheduledAt ?? item.createdAt;
  const ageLabel = formatDistanceToNow(new Date(when), { addSuffix: true, locale: itLocale });
  const canSnooze = item.source === "email_campaign_queue" || item.source === "campaign_jobs";

  return (
    <article className="rounded-lg border bg-card hover:bg-accent/30 transition-colors p-3">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center", ch.tone)}>
          <ch.Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-[10px] font-medium", st.tone)}>{st.label}</Badge>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{ch.label}</span>
            {item.status === "blocked" && <AlertOctagon className="h-3.5 w-3.5 text-rose-500" />}
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" /> {ageLabel}
            </span>
          </div>

          <div className="mt-1 truncate text-sm font-medium text-foreground">
            {item.subject ?? "(senza oggetto)"}
          </div>

          <div className="text-xs text-muted-foreground truncate">
            {item.recipientName ?? item.recipientHandle ?? "—"}
            {item.recipientHandle && item.recipientName && (
              <span className="opacity-60"> · {item.recipientHandle}</span>
            )}
          </div>

          {item.preview && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{item.preview}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" className="h-7 gap-1.5" onClick={onConfirm}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Conferma
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Modifica
            </Button>
            {canSnooze && (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={onSnooze}>
                <Clock className="h-3.5 w-3.5" /> +1h
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive hover:text-destructive" onClick={onCancel}>
              <Trash2 className="h-3.5 w-3.5" /> Annulla
            </Button>
          </div>
        </div>
      </div>
    </article>
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

export default CestinonePage;