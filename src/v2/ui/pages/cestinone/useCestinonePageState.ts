import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCestinone } from "@/v2/hooks/useCestinone";
import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import type { CestinoChannel, CestinoItem } from "@/data/cestinone";

export function useCestinonePageState() {
  const [channel, setChannel] = useState<CestinoChannel | "all">("all");
  const [status, setStatus] = useState<"pending" | "queued">("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());

  const { items: rawItems, counts, isLoading, cancel, snooze, dismiss } = useCestinone({ channel, status: "all", search });

  const items = useMemo(() => {
    const filtered = rawItems.filter((it) =>
      status === "pending"
        ? it.status === "pending"
        : it.status === "queued" || it.status === "scheduled"
    );
    if (status === "queued") {
      return [...filtered].sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    }
    return filtered;
  }, [rawItems, status]);

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
  function handleOpenOrigin(item: CestinoItem): void { navigate(originHref(item)); }
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

  return {
    channel, setChannel,
    status, setStatus,
    search, setSearch,
    selectedId, setSelectedId,
    bulkIds, toggleBulk, toggleBulkAll, clearBulk,
    handleBulkCancel, handleBulkSnooze,
    items, counts, isLoading, inCodaTotal, nextDepartingIds, selected,
    handleConfirm, handleEdit, handleOpenOrigin, handleOpenPartner,
    handleRunSherlock, handleCancel, handleSnooze,
  };
}