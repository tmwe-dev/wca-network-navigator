/**
 * AISuggestionsTab — vista degli address (classificati o non) con stessa
 * estetica delle card di Gestione Manuale: logo dominio, bandiera, badge
 * gruppo. Niente percentuali fittizie di "confidenza".
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSenderGroupsOrdered } from "@/data/emailGrouping";
import { findSuggestionAddressRules, assignSuggestionGroup, clearAiSuggestion } from "@/data/aiSuggestions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";

import { Sparkles, Loader2, PanelLeftClose, PanelLeftOpen, Layers } from "lucide-react";
import { ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01 } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { invokeAi } from "@/lib/ai/invokeAi";
import { deriveSenderDisplayName } from "@/lib/senderDisplayName";
import type { EmailSenderGroup, SenderAnalysis } from "@/types/email-management";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { SenderEmailPreviewPanel } from "./management/SenderEmailPreviewPanel";
import { MultiSelectBulkBar } from "./management/MultiSelectBulkBar";
import { SenderActionsDialog } from "./management/SenderActionsDialog";
import { DeepSearchEmailBulkButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailBulkButton";
import { ClassificationInsightsPanel } from "./ClassificationInsightsPanel";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useMailboxSenderAllowlist } from "@/hooks/useMailboxSenderAllowlist";
import { SuggestionCard, type AddressRow } from "./SuggestionCard";
import {
  getDomain,
  sortRows,
  groupRowsBySuggestion,
  type StatusFilter,
  type SortMode,
  type SuggestedGroupFilter,
} from "./aiSuggestionsTab.helpers";
import { createLogger } from "@/lib/log";

const log = createLogger("AISuggestionsTab");

export default function AISuggestionsTab() {
  const qc = useQueryClient();
  // SSOT: la soglia "Min. email" vive nei filtri globali (chiave `emailIntelVolume`)
  // così slider in toolbar e chip nel drawer restano sincronizzati.
  const g = useGlobalFilters();
  const minEmailCount =
    g.filters.emailIntelVolume === "all" ? 1 : Math.max(1, parseInt(g.filters.emailIntelVolume, 10) || 1);
  const setMinEmailCount = useCallback(
    (v: number) => {
      const safe = Math.max(1, Math.min(20, Math.round(v)));
      g.setFilter("emailIntelVolume", safe <= 1 ? "all" : String(safe));
    },
    [g],
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("uncategorized");
  const [suggestedGroupFilter, _setSuggestedGroupFilter] = useState<string>("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [previewEmail, setPreviewEmail] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [groupBySuggestion, setGroupBySuggestion] = useState(false);
  const [actionsRow, setActionsRow] = useState<AddressRow | null>(null);
  // Card che stanno scomparendo (animazione fade-out prima di rimuoverle dalla lista)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  // Override locale per nascondere subito una card (non ricompare quando React Query rinfresca)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const animateRemoval = useCallback((id: string) => {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  }, []);

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.email.senderGroups,
    queryFn: async () => {
      const list = (await fetchSenderGroupsOrdered()) as EmailSenderGroup[];
      return [...list].sort((a, b) =>
        a.nome_gruppo.localeCompare(b.nome_gruppo, "it", { sensitivity: "base", numeric: true }),
      );
    },
  });

  // Mailbox-awareness: l'allowlist contiene gli indirizzi che hanno
  // effettivamente scritto nella casella attiva. Le regole sono shared,
  // ma qui mostriamo solo i mittenti pertinenti.
  const { allowlist, mailboxKey } = useMailboxSenderAllowlist();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [...queryKeys.ai.suggestions, statusFilter, minEmailCount, mailboxKey],
    enabled: !!allowlist,
    queryFn: async () => {
      // "uncategorized" esclude anche group_name legacy: nessun mittente
      // già messo in un gruppo deve riapparire fra i suggerimenti.
      const all = (await findSuggestionAddressRules({ statusFilter, minEmailCount })) as AddressRow[];
      if (!allowlist) return [];
      return all.filter((r) => allowlist.has((r.email_address || "").toLowerCase()));
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (emails?: string[]) => {
      const data = await invokeAi<{ processed: number }>("suggest-email-groups", {
        scope: "classify",
        context: { source: "AISuggestionsTab" },
        body: {
          min_email_count: minEmailCount,
          batch_size: 20,
          emails: emails && emails.length > 0 ? emails : undefined,
        },
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data?.processed || 0} address analizzati`);
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const acceptMutation = useMutation({
    mutationFn: async (row: AddressRow) => {
      const group = groups.find((g) => g.nome_gruppo === row.ai_suggested_group);
      if (!group) throw new Error("Gruppo non trovato");
      await assignSuggestionGroup(row.id, {
        group_id: group.id,
        group_name: group.nome_gruppo,
        group_color: group.colore,
        group_icon: group.icon,
        ai_suggestion_accepted: true,
      });
      return row.id;
    },
    onSuccess: (id) => {
      toast.success("Suggerimento accettato");
      animateRemoval(id);
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ row, groupId }: { row: AddressRow; groupId: string }) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return null;
      await assignSuggestionGroup(row.id, {
        group_id: group.id,
        group_name: group.nome_gruppo,
        group_color: group.colore,
        group_icon: group.icon,
        ai_suggestion_accepted: false,
      });
      // Trigger Refiner se la scelta diverge dal suggerimento AI (best-effort)
      if (row.ai_suggested_group && row.ai_suggested_group !== group.nome_gruppo) {
        invokeEdge("refine-classification-rule", {
          body: { address_rule_id: row.id, chosen_group_id: group.id },
          context: "ai-suggestions-tab-assign",
        })
          .then(() => {
            qc.invalidateQueries({ queryKey: queryKeys.ai.classificationInsights("pending") });
          })
          .catch((err: Error) => {
            log.warn("[refine] skipped:", { detail: err.message });
          });
      }
      return row.id;
    },
    onSuccess: (id) => {
      toast.success("Gruppo assegnato");
      if (id) animateRemoval(id);
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (row: AddressRow) => {
      await clearAiSuggestion(row.id);
      return row.id;
    },
    onSuccess: (id) => {
      toast.info("Suggerimento ignorato");
      animateRemoval(id);
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  const busy = acceptMutation.isPending || assignMutation.isPending || ignoreMutation.isPending;

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => !hiddenIds.has(row.id));
    if (suggestedGroupFilter === "all") return filtered;
    if (suggestedGroupFilter === "none") return filtered.filter((row) => !row.ai_suggested_group);
    return filtered.filter((row) => row.ai_suggested_group === suggestedGroupFilter);
  }, [rows, suggestedGroupFilter, hiddenIds]);

  const sortedRows = useMemo(() => sortRows(visibleRows, sortMode), [visibleRows, sortMode]);

  const groupedRows = useMemo(
    () => (groupBySuggestion ? groupRowsBySuggestion(sortedRows) : null),
    [groupBySuggestion, sortedRows],
  );

  const _suggestedGroupOptions = useMemo<SuggestedGroupFilter[]>(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.ai_suggested_group ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const base: SuggestedGroupFilter[] = [{ value: "all", label: "Tutti", count: rows.length, icon: null }];
    const named = groups
      .filter((group) => counts.has(group.nome_gruppo))
      .map((group) => ({
        value: group.nome_gruppo,
        label: group.nome_gruppo,
        count: counts.get(group.nome_gruppo) ?? 0,
        icon: group.icon ?? null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base", numeric: true }));

    if ((counts.get("none") ?? 0) > 0) {
      base.push({ value: "none", label: "Senza suggerimento", count: counts.get("none") ?? 0, icon: null });
    }

    return [...base, ...named];
  }, [groups, rows]);

  const selectedRows = useMemo(
    () => visibleRows.filter((row) => selectedEmails.has(row.email_address)),
    [selectedEmails, visibleRows],
  );

  const previewRow = useMemo(
    () => sortedRows.find((row) => row.email_address === previewEmail) ?? sortedRows[0] ?? null,
    [previewEmail, sortedRows],
  );

  const toggleSelection = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleBulkAssign = async (senders: AddressRow[], groupName: string, groupId: string) => {
    await Promise.all(
      senders.map((row) =>
        assignMutation
          .mutateAsync({ row, groupId })
          .then(() => row)
          .catch(() => row),
      ),
    );
    setSelectedEmails(new Set());
    toast.success(`${senders.length} address → ${groupName}`);
  };

  const bulkSelected = selectedRows.map((row) => ({
    email: row.email_address,
    domain: row.domain || getDomain(row.email_address),
    companyName: row.company_name || row.display_name || deriveSenderDisplayName(row.email_address),
    emailCount: row.email_count,
    firstSeen: "",
    lastSeen: "",
    isClassified: row.group_id != null,
  }));

  return (
    <div className="flex flex-col h-full gap-4">
      <ClassificationInsightsPanel />
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={() =>
            analyzeMutation.mutate(selectedRows.length > 0 ? selectedRows.map((row) => row.email_address) : undefined)
          }
          disabled={analyzeMutation.isPending}
          className="gap-2"
        >
          {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {selectedRows.length > 0 ? `Analizza selezione (${selectedRows.length})` : "Analizza con AI"}
        </Button>

        <DeepSearchEmailBulkButton
          items={selectedRows.map((row) => ({
            email: row.email_address,
            displayName: row.display_name,
            companyName: row.company_name ?? undefined,
          }))}
          disabled={selectedRows.length === 0}
          variant="outline"
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2 border-l border-border/40">
          <span className="whitespace-nowrap">Min. email</span>
          <div className="w-24">
            <Slider value={[minEmailCount]} onValueChange={([v]) => setMinEmailCount(v)} min={1} max={20} step={1} />
          </div>
          <Badge variant="outline" className="tabular-nums">
            {minEmailCount}
          </Badge>
        </div>

        {/* Toggle binario classificate */}
        <div className="inline-flex h-9 rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter("uncategorized")}
            className={cn(
              "px-3 text-xs font-medium rounded-sm transition-colors",
              statusFilter === "uncategorized"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Da classificare
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 text-xs font-medium rounded-sm transition-colors",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Tutti
          </button>
        </div>

        {/* Sort: due bottoni toggle */}
        <Button
          variant={sortMode.startsWith("name") ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setSortMode((m) => (m === "name-asc" ? "name-desc" : "name-asc"))}
          title="Ordina per nome"
        >
          {sortMode === "name-desc" ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
          <span className="text-xs">Nome</span>
        </Button>
        <Button
          variant={sortMode.startsWith("count") ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setSortMode((m) => (m === "count-desc" ? "count-asc" : "count-desc"))}
          title="Ordina per numero di email"
        >
          {sortMode === "count-asc" ? <ArrowUp01 className="h-3.5 w-3.5" /> : <ArrowDown01 className="h-3.5 w-3.5" />}
          <span className="text-xs">Email</span>
        </Button>

        <Badge variant="outline" className="ml-auto text-xs tabular-nums">
          {visibleRows.length} address
        </Badge>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <Sparkles className="h-10 w-10 mb-2 text-primary" />
          <p className="text-sm">Nessun address con questi filtri</p>
          <p className="text-xs mt-1">Abbassa &quot;Min. email&quot; o cambia il filtro</p>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0 rounded-lg border">
          {showPreview && (
            <>
              <ResizablePanel defaultSize={32} minSize={22} maxSize={55}>
                <div className="h-full flex flex-col overflow-hidden">
                  <SenderEmailPreviewPanel
                    senderEmail={previewRow?.email_address ?? null}
                    companyName={
                      previewRow?.company_name ||
                      previewRow?.display_name ||
                      (previewRow ? deriveSenderDisplayName(previewRow.email_address) : null)
                    }
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={showPreview ? 68 : 100} minSize={35}>
            <div className="h-full flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={() => setShowPreview((value) => !value)}
                    aria-label={showPreview ? "Nascondi anteprima" : "Mostra anteprima"}
                  >
                    {showPreview ? (
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelLeftOpen className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <span className="text-xs font-semibold text-foreground truncate">Suggerimenti AI</span>
                  <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">
                    {visibleRows.length}
                  </Badge>
                  <Button
                    variant={groupBySuggestion ? "default" : "outline"}
                    size="sm"
                    className="h-7 gap-1.5 ml-2"
                    onClick={() => setGroupBySuggestion((v) => !v)}
                    title="Raggruppa per suggerimento AI"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span className="text-xs">Raggruppa AI</span>
                  </Button>
                </div>

                {selectedRows.length > 0 && (
                  <span className="text-[11px] text-primary font-semibold whitespace-nowrap">
                    {selectedRows.length} selezionati
                  </span>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-3 p-3 pr-2">
                  {groupedRows
                    ? groupedRows.map((bucket) => (
                        <div key={bucket.key} className="flex flex-col gap-2">
                          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-2 py-1 rounded-md border border-border/50 flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold text-foreground">{bucket.label}</span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {bucket.items.length}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-2">
                            {bucket.items.map((row) => (
                              <SuggestionCard
                                key={row.id}
                                row={row}
                                groups={groups}
                                isSelected={selectedEmails.has(row.email_address)}
                                isFocused={previewRow?.email_address === row.email_address}
                                isRemoving={removingIds.has(row.id)}
                                onToggleSelect={toggleSelection}
                                onFocus={(current) => setPreviewEmail(current.email_address)}
                                onAnalyzeOne={(current) => analyzeMutation.mutate([current.email_address])}
                                onAccept={(r) => acceptMutation.mutate(r)}
                                onIgnore={(r) => ignoreMutation.mutate(r)}
                                onAssign={(r, gId) => assignMutation.mutate({ row: r, groupId: gId })}
                                onOpenActions={(r) => setActionsRow(r)}
                                busy={busy || analyzeMutation.isPending}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    : sortedRows.map((row) => (
                        <SuggestionCard
                          key={row.id}
                          row={row}
                          groups={groups}
                          isSelected={selectedEmails.has(row.email_address)}
                          isFocused={previewRow?.email_address === row.email_address}
                          isRemoving={removingIds.has(row.id)}
                          onToggleSelect={toggleSelection}
                          onFocus={(current) => setPreviewEmail(current.email_address)}
                          onAnalyzeOne={(current) => analyzeMutation.mutate([current.email_address])}
                          onAccept={(r) => acceptMutation.mutate(r)}
                          onIgnore={(r) => ignoreMutation.mutate(r)}
                          onAssign={(r, gId) => assignMutation.mutate({ row: r, groupId: gId })}
                          onOpenActions={(r) => setActionsRow(r)}
                          busy={busy || analyzeMutation.isPending}
                        />
                      ))}
                </div>
              </ScrollArea>

              {selectedRows.length > 0 && (
                <MultiSelectBulkBar
                  selectedSenders={bulkSelected}
                  groups={groups}
                  onAssignGroup={(senders, groupName, groupId) =>
                    handleBulkAssign(
                      selectedRows.filter((row) => senders.some((sender) => sender.email === row.email_address)),
                      groupName,
                      groupId,
                    )
                  }
                  onComplete={() => {
                    setSelectedEmails(new Set());
                    qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
                  }}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <SenderActionsDialog
        sender={
          actionsRow
            ? ({
                email: actionsRow.email_address,
                domain: actionsRow.domain || getDomain(actionsRow.email_address),
                companyName:
                  actionsRow.company_name ||
                  actionsRow.display_name ||
                  deriveSenderDisplayName(actionsRow.email_address),
                emailCount: actionsRow.email_count,
                firstSeen: "",
                lastSeen: "",
                isClassified: actionsRow.group_id != null,
              } as SenderAnalysis)
            : null
        }
        open={actionsRow != null}
        onOpenChange={(open) => {
          if (!open) setActionsRow(null);
        }}
        onActionDone={() => {
          qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
        }}
      />
    </div>
  );
}
