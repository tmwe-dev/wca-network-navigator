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
import { CheckCircle2, Search } from "lucide-react";
import { useCestinone } from "@/v2/hooks/useCestinone";
import type { CestinoChannel, CestinoStatus, CestinoItem } from "@/data/cestinone";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CestinoCardV2 } from "@/v2/ui/organisms/CestinoCardV2";

export function CestinonePage(): React.ReactElement {
  const [channel, setChannel] = useState<CestinoChannel | "all">("all");
  const [status, setStatus] = useState<CestinoStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { items, counts, isLoading, cancel, snooze } = useCestinone({ channel, status, search });
  const navigate = useNavigate();

  function handleConfirm(item: CestinoItem) {
    // La conferma passa SEMPRE dal canale di origine — niente bypass editorial review.
    if (item.source === "email_campaign_queue") {
      navigate(`/v2/communicate/outreach?queue=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
      toast.info("Apro la coda email per conferma manuale.");
      return;
    }
    if (item.source === "campaign_jobs") {
      navigate(`/v2/communicate/campaigns?job=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
      toast.info("Apro i campaign jobs.");
      return;
    }
    if (item.source === "cockpit_queue") {
      navigate(`/v2/communicate/outreach?cockpit=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
      toast.info("Apro il cockpit.");
      return;
    }
    navigate(`/v2/communicate/outreach?multi=${encodeURIComponent(item.id.split(":")[1] ?? "")}`);
  }

  function handleEdit(item: CestinoItem) {
    if (item.partnerId) navigate(`/v2/communicate/compose?partner=${item.partnerId}`);
    else navigate("/v2/communicate/compose");
  }

  function handleOpenPartner(item: CestinoItem) {
    if (item.partnerId) navigate(`/v2/network/partners/${item.partnerId}`);
  }

  function handleRunSherlock(item: CestinoItem) {
    if (item.partnerId) {
      navigate(`/v2/sherlock?partner=${item.partnerId}`);
      toast.info("Apro Sherlock per la deep search.");
    }
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
            <CestinoCardV2
              key={item.id}
              item={item}
              onConfirm={() => handleConfirm(item)}
              onEdit={() => handleEdit(item)}
              onSnooze={(minutes) => snooze.mutate({ item, minutes }, {
                onSuccess: () => toast.success(`Rinviato di ${minutes} minuti`),
                onError: (e) => toast.error("Snooze fallito", { description: String(e) }),
              })}
              onCancel={() => cancel.mutate(item, {
                onSuccess: () => toast.success("Annullato"),
                onError: (e) => toast.error("Annullamento fallito", { description: String(e) }),
              })}
              onGotoOrigin={() => handleConfirm(item)}
              onOpenPartner={item.partnerId ? () => handleOpenPartner(item) : undefined}
              onRunSherlock={item.partnerId ? () => handleRunSherlock(item) : undefined}
            />
          ))
        )}
      </div>
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

export default CestinonePage;