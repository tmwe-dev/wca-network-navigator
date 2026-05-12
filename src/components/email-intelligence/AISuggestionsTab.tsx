/**
 * AISuggestionsTab — vista degli address (classificati o non) con stessa
 * estetica delle card di Gestione Manuale: logo dominio, bandiera, badge
 * gruppo. Niente percentuali fittizie di "confidenza".
 */
import { memo, useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Check, X, Loader2, Mail, Wand2, ArrowRight, PanelLeftClose, PanelLeftOpen, Layers,
} from "lucide-react";
import { Settings2, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01 } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { getFlagFromDomain, getDomainFaviconUrl } from "@/lib/domainUtils";
import { deriveSenderDisplayName } from "@/lib/senderDisplayName";
import type { EmailSenderGroup, SenderAnalysis } from "@/types/email-management";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { SenderEmailPreviewPanel } from "./management/SenderEmailPreviewPanel";
import { MultiSelectBulkBar } from "./management/MultiSelectBulkBar";
import { SenderActionsDialog } from "./management/SenderActionsDialog";
import { DeepSearchEmailButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailButton";
import { DeepSearchEmailBulkButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailBulkButton";
import { ClassificationInsightsPanel } from "./ClassificationInsightsPanel";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useMailboxSenderAllowlist } from "@/hooks/useMailboxSenderAllowlist";

interface AddressRow {
  id: string;
  email_address: string;
  display_name: string | null;
  email_count: number;
  company_name?: string | null;
  domain?: string | null;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  group_icon: string | null;
  ai_suggested_group: string | null;
  ai_suggestion_confidence?: number | null;
}

type StatusFilter = "uncategorized" | "categorized" | "all";
type SortMode = "name-asc" | "name-desc" | "count-desc" | "count-asc";

interface SuggestedGroupFilter {
  value: string;
  label: string;
  count: number;
  icon: string | null;
}

function getDomain(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : email;
}

function getInitials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface CardProps {
  row: AddressRow;
  groups: EmailSenderGroup[];
  isSelected: boolean;
  isFocused: boolean;
  isRemoving: boolean;
  onToggleSelect: (email: string) => void;
  onFocus: (row: AddressRow) => void;
  onAnalyzeOne: (row: AddressRow) => void;
  onAccept: (row: AddressRow) => void;
  onIgnore: (row: AddressRow) => void;
  onAssign: (row: AddressRow, groupId: string) => void;
  onOpenActions: (row: AddressRow) => void;
  busy: boolean;
}

const SuggestionCard = memo(function SuggestionCard({
  row, groups, isSelected, isFocused, isRemoving, onToggleSelect, onFocus, onAnalyzeOne, onAccept, onIgnore, onAssign, onOpenActions, busy,
}: CardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const domain = row.domain || getDomain(row.email_address);
  const flag = getFlagFromDomain(domain);
  const faviconUrl = getDomainFaviconUrl(domain);
  const company = row.company_name || row.display_name || deriveSenderDisplayName(row.email_address);
  const initials = getInitials(company);

  const suggestedGroup = useMemo(
    () => groups.find((g) => g.nome_gruppo === row.ai_suggested_group),
    [groups, row.ai_suggested_group],
  );
  const currentGroup = useMemo(
    () => groups.find((g) => g.id === row.group_id),
    [groups, row.group_id],
  );

  const accent = currentGroup?.colore
    || suggestedGroup?.colore
    || (row.email_count > 100 ? "hsl(var(--destructive))" : "hsl(var(--primary))");

  return (
    <Card
      className={cn(
        "border-l-4 transition-all hover:shadow-md cursor-pointer",
        "transition-[opacity,transform,max-height,margin,padding] duration-300 ease-out overflow-hidden",
        isFocused && "ring-2 ring-primary shadow-md",
        isSelected && "border-2 border-primary bg-primary/5",
        isRemoving && "opacity-0 scale-95 -translate-y-1 max-h-0 my-0 py-0 border-0 pointer-events-none",
      )}
      style={{ borderLeftColor: accent }}
      onClick={() => onFocus(row)}
    >
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          {faviconUrl && !faviconError ? (
            <img
              src={faviconUrl}
              alt=""
              className="h-10 w-10 rounded-md flex-shrink-0 object-contain bg-background border border-border/50"
              loading="lazy"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary leading-none">{initials}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div
              className="font-semibold text-sm text-foreground leading-snug break-words capitalize"
              title={company}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {company}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground mt-0.5">
              {flag && (
                <span className="text-sm leading-none flex-shrink-0" title={domain}>
                  {flag}
                </span>
              )}
              <span className="truncate" title={row.email_address}>{row.email_address}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1 flex-shrink-0">
            <Mail className="h-3 w-3 text-muted-foreground self-center" />
            <span className="text-base font-bold text-primary leading-none">
              {row.email_count}
            </span>
          </div>
        </div>

        {row.ai_suggested_group ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFocus(row);
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-left"
          >
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-primary/80 leading-none">
                Suggerimento AI
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {suggestedGroup?.icon && <span>{suggestedGroup.icon}</span>}
                <span className="text-xs font-semibold text-foreground truncate leading-tight">
                  {row.ai_suggested_group}
                </span>
              </div>
            </div>
          </button>
        ) : null}

        {/* Stato corrente o suggerimento */}
        {currentGroup ? (
          <Badge
            variant="secondary"
            className="gap-1 text-[11px] py-0.5 h-6 px-2 self-start"
            style={{
              backgroundColor: (currentGroup.colore || "#666") + "22",
              color: currentGroup.colore || undefined,
              borderColor: (currentGroup.colore || "#666") + "55",
            }}
          >
            <span>{currentGroup.icon}</span>
            <Check className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{currentGroup.nome_gruppo}</span>
          </Badge>
        ) : !row.ai_suggested_group ? (
          <div className="text-[11px] text-muted-foreground italic px-1">
            Nessuna classificazione — assegna un gruppo
          </div>
        ) : null}

        {/* FOOTER azioni */}
        <div className="flex items-center gap-1.5 pt-2 mt-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(row.email_address)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 flex-shrink-0"
            aria-label="Seleziona address"
          />

          {/* Assegna gruppo: solo icona + freccetta, niente sbarra nera */}
          <Select onValueChange={(gId) => onAssign(row, gId)} disabled={busy}>
            <SelectTrigger
              className="h-8 w-auto gap-1 px-2 text-xs border border-border/60 bg-background hover:bg-muted/40 shadow-none [&>svg:last-child]:opacity-70"
              aria-label={currentGroup ? "Cambia gruppo" : "Assegna gruppo"}
              title={currentGroup ? "Cambia gruppo" : "Assegna gruppo"}
            >
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="mr-1.5">{g.icon}</span>{g.nome_gruppo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 gap-1"
            onClick={(event) => {
              event.stopPropagation();
              onOpenActions(row);
            }}
            disabled={busy}
            title="Azioni e regole"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">Azioni</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 gap-1"
            onClick={(event) => {
              event.stopPropagation();
              onAnalyzeOne(row);
            }}
            disabled={busy}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs">AI</span>
          </Button>

          <div onClick={(e) => e.stopPropagation()} className="inline-flex">
            <DeepSearchEmailButton
              email={row.email_address}
              source={{ displayName: row.display_name, companyName: row.company_name ?? undefined }}
              size="sm"
              variant="outline"
              className="h-8 px-2.5 gap-1"
              label="Deep"
            />
          </div>

          {row.ai_suggested_group && !currentGroup && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-8 px-2.5 gap-1"
                onClick={() => onAccept(row)}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span className="text-xs">Accetta</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10")}
                onClick={() => onIgnore(row)}
                disabled={busy}
                title="Ignora suggerimento AI"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default function AISuggestionsTab() {
  const qc = useQueryClient();
  // SSOT: la soglia "Min. email" vive nei filtri globali (chiave `emailIntelVolume`)
  // così slider in toolbar e chip nel drawer restano sincronizzati.
  const g = useGlobalFilters();
  const minEmailCount = g.filters.emailIntelVolume === "all"
    ? 1
    : Math.max(1, parseInt(g.filters.emailIntelVolume, 10) || 1);
  const setMinEmailCount = useCallback((v: number) => {
    const safe = Math.max(1, Math.min(20, Math.round(v)));
    g.setFilter("emailIntelVolume", safe <= 1 ? "all" : String(safe));
  }, [g]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("uncategorized");
  const [suggestedGroupFilter, setSuggestedGroupFilter] = useState<string>("all");
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
      const { data } = await supabase
        .from("email_sender_groups")
        .select("*")
        .order("sort_order", { ascending: true });
      const list = (data || []) as EmailSenderGroup[];
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
      let q = supabase
        .from("email_address_rules")
        .select("id, email_address, display_name, company_name, domain, email_count, group_id, group_name, group_color, group_icon, ai_suggested_group, ai_suggestion_confidence")
        .gte("email_count", minEmailCount)
        .order("email_count", { ascending: false })
        .limit(500);

      if (statusFilter === "uncategorized") q = q.is("group_id", null);
      else if (statusFilter === "categorized") q = q.not("group_id", "is", null);

      const { data, error } = await q;
      if (error) throw error;
      const all = (data || []) as AddressRow[];
      if (!allowlist) return [];
      return all.filter((r) => allowlist.has((r.email_address || "").toLowerCase()));
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (emails?: string[]) => {
      const data = await invokeEdge<{ processed: number }>("suggest-email-groups", {
        body: { min_email_count: minEmailCount, batch_size: 20, emails: emails && emails.length > 0 ? emails : undefined },
        context: "ai-suggestions-tab",
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
      await supabase.from("email_address_rules").update({
        group_id: group.id,
        group_name: group.nome_gruppo,
        group_color: group.colore,
        group_icon: group.icon,
        ai_suggestion_accepted: true,
      }).eq("id", row.id);
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
      await supabase.from("email_address_rules").update({
        group_id: group.id,
        group_name: group.nome_gruppo,
        group_color: group.colore,
        group_icon: group.icon,
        ai_suggestion_accepted: false,
      }).eq("id", row.id);
      // Trigger Refiner se la scelta diverge dal suggerimento AI (best-effort)
      if (row.ai_suggested_group && row.ai_suggested_group !== group.nome_gruppo) {
        invokeEdge("refine-classification-rule", {
          body: { address_rule_id: row.id, chosen_group_id: group.id },
          context: "ai-suggestions-tab-assign",
        }).then(() => {
          qc.invalidateQueries({ queryKey: queryKeys.ai.classificationInsights("pending") });
        }).catch((err: Error) => {
          console.warn("[refine] skipped:", err.message);
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
      await supabase.from("email_address_rules")
        .update({ ai_suggestion_accepted: false, ai_suggested_group: null })
        .eq("id", row.id);
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

  const sortedRows = useMemo(() => {
    const sorted = [...visibleRows];
    const nameOf = (r: AddressRow) =>
      (r.company_name || r.display_name || deriveSenderDisplayName(r.email_address) || r.email_address).toLowerCase();
    switch (sortMode) {
      case "name-asc":
        return sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "it", { sensitivity: "base", numeric: true }));
      case "name-desc":
        return sorted.sort((a, b) => nameOf(b).localeCompare(nameOf(a), "it", { sensitivity: "base", numeric: true }));
      case "count-desc":
        return sorted.sort((a, b) => b.email_count - a.email_count);
      case "count-asc":
        return sorted.sort((a, b) => a.email_count - b.email_count);
    }
  }, [visibleRows, sortMode]);

  const groupedRows = useMemo(() => {
    if (!groupBySuggestion) return null;
    const buckets = new Map<string, AddressRow[]>();
    sortedRows.forEach((row) => {
      const key = row.ai_suggested_group ?? "__none__";
      const arr = buckets.get(key) ?? [];
      arr.push(row);
      buckets.set(key, arr);
    });
    const entries = Array.from(buckets.entries()).map(([key, items]) => ({
      key,
      label: key === "__none__" ? "Senza suggerimento" : key,
      items,
    }));
    entries.sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.label.localeCompare(b.label, "it", { sensitivity: "base", numeric: true });
    });
    return entries;
  }, [groupBySuggestion, sortedRows]);

  const suggestedGroupOptions = useMemo<SuggestedGroupFilter[]>(() => {
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
        assignMutation.mutateAsync({ row, groupId }).then(() => row).catch(() => row),
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
    isClassified: row.group_id !== null,
  }));

  return (
    <div className="flex flex-col h-full gap-4">
      <ClassificationInsightsPanel />
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={() => analyzeMutation.mutate(selectedRows.length > 0 ? selectedRows.map((row) => row.email_address) : undefined)}
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
          <Badge variant="outline" className="tabular-nums">{minEmailCount}</Badge>
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
          <Sparkles className="h-10 w-10 mb-2 text-primary/30" />
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
                    companyName={previewRow?.company_name || previewRow?.display_name || (previewRow ? deriveSenderDisplayName(previewRow.email_address) : null)}
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
                    {showPreview ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
                  </Button>
                  <span className="text-xs font-semibold text-foreground truncate">
                    Suggerimenti AI
                  </span>
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
                            <Badge variant="outline" className="text-[10px] h-5">{bucket.items.length}</Badge>
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
                  onAssignGroup={(senders, groupName, groupId) => handleBulkAssign(selectedRows.filter((row) => senders.some((sender) => sender.email === row.email_address)), groupName, groupId)}
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
                isClassified: actionsRow.group_id !== null,
              } as SenderAnalysis)
            : null
        }
        open={actionsRow !== null}
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
