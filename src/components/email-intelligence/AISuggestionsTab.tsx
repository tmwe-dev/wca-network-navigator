/**
 * AISuggestionsTab — vista degli address (classificati o non) con stessa
 * estetica delle card di Gestione Manuale: logo dominio, bandiera, badge
 * gruppo. Niente percentuali fittizie di "confidenza".
 */
import { memo, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Check, X, Loader2, Mail, Wand2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { getFlagFromDomain, getDomainFaviconUrl } from "@/lib/domainUtils";
import type { EmailSenderGroup } from "@/types/email-management";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

interface AddressRow {
  id: string;
  email_address: string;
  display_name: string | null;
  email_count: number;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  group_icon: string | null;
  ai_suggested_group: string | null;
}

type StatusFilter = "uncategorized" | "categorized" | "all";

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
  onAccept: (row: AddressRow) => void;
  onIgnore: (row: AddressRow) => void;
  onAssign: (row: AddressRow, groupId: string) => void;
  busy: boolean;
}

const SuggestionCard = memo(function SuggestionCard({
  row, groups, onAccept, onIgnore, onAssign, busy,
}: CardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const domain = getDomain(row.email_address);
  const flag = getFlagFromDomain(domain);
  const faviconUrl = getDomainFaviconUrl(domain);
  const company = row.display_name || domain.split(".")[0];
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
      className="border-l-4 transition-all hover:shadow-md"
      style={{ borderLeftColor: accent }}
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
            <div className="flex items-center gap-1.5 text-xs text-foreground/70 mt-0.5">
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
        ) : row.ai_suggested_group ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30">
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
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground italic px-1">
            Nessuna classificazione — assegna un gruppo
          </div>
        )}

        {/* FOOTER azioni */}
        <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border/40">
          <Select onValueChange={(gId) => onAssign(row, gId)} disabled={busy}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <Wand2 className="h-3.5 w-3.5 mr-1 text-primary" />
              <SelectValue placeholder={currentGroup ? "Cambia gruppo" : "Assegna gruppo"} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="mr-1.5">{g.icon}</span>{g.nome_gruppo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
  const [minEmailCount, setMinEmailCount] = useState(3);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("uncategorized");

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.email.senderGroups,
    queryFn: async () => {
      const { data } = await supabase
        .from("email_sender_groups")
        .select("*")
        .order("sort_order", { ascending: true });
      return (data || []) as EmailSenderGroup[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [...queryKeys.ai.suggestions, statusFilter, minEmailCount],
    queryFn: async () => {
      let q = supabase
        .from("email_address_rules")
        .select("id, email_address, display_name, email_count, group_id, group_name, group_color, group_icon, ai_suggested_group")
        .gte("email_count", minEmailCount)
        .order("email_count", { ascending: false })
        .limit(500);

      if (statusFilter === "uncategorized") q = q.is("group_id", null);
      else if (statusFilter === "categorized") q = q.not("group_id", "is", null);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AddressRow[];
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const data = await invokeEdge<{ processed: number }>("suggest-email-groups", {
        body: { min_email_count: minEmailCount, batch_size: 20 },
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
    },
    onSuccess: () => {
      toast.success("Suggerimento accettato");
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ row, groupId }: { row: AddressRow; groupId: string }) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      await supabase.from("email_address_rules").update({
        group_id: group.id,
        group_name: group.nome_gruppo,
        group_color: group.colore,
        group_icon: group.icon,
        ai_suggestion_accepted: false,
      }).eq("id", row.id);
    },
    onSuccess: () => {
      toast.success("Gruppo assegnato");
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (row: AddressRow) => {
      await supabase.from("email_address_rules")
        .update({ ai_suggestion_accepted: false, ai_suggested_group: null })
        .eq("id", row.id);
    },
    onSuccess: () => {
      toast.info("Suggerimento ignorato");
      qc.invalidateQueries({ queryKey: queryKeys.ai.suggestions });
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount });
    },
  });

  const busy = acceptMutation.isPending || assignMutation.isPending || ignoreMutation.isPending;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} className="gap-2">
          {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Analizza con AI
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Min. email:</span>
          <div className="w-32">
            <Slider value={[minEmailCount]} onValueChange={([v]) => setMinEmailCount(v)} min={1} max={20} step={1} />
          </div>
          <Badge variant="outline">{minEmailCount}</Badge>
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uncategorized">📭 Non classificate</SelectItem>
            <SelectItem value="categorized">✅ Già classificate</SelectItem>
            <SelectItem value="all">🌐 Tutte</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="outline" className="ml-auto text-xs">
          {rows.length} address
        </Badge>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <Sparkles className="h-10 w-10 mb-2 text-primary/30" />
          <p className="text-sm">Nessun address con questi filtri</p>
          <p className="text-xs mt-1">Abbassa &quot;Min. email&quot; o cambia il filtro</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pr-2">
            {rows.map((row) => (
              <SuggestionCard
                key={row.id}
                row={row}
                groups={groups}
                onAccept={(r) => acceptMutation.mutate(r)}
                onIgnore={(r) => ignoreMutation.mutate(r)}
                onAssign={(r, gId) => assignMutation.mutate({ row: r, groupId: gId })}
                busy={busy}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
