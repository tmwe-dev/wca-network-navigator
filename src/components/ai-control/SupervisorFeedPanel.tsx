/**
 * SupervisorFeedPanel — Unified audit trail feed for the AI Control Center.
 * LOVABLE-93: audit trail viewer
 */
import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  User, Brain, Cog, Clock, ChevronDown, ShieldCheck, Search,
  ExternalLink, Filter, LayoutGrid, Table2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { it } from "date-fns/locale";
import { queryKeys } from "@/lib/queryKeys";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ──

interface AuditRow {
  id: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  action_category: string;
  action_detail: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  partner_id: string | null;
  email_address: string | null;
  decision_origin: string;
  ai_decision_log_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Constants ──

const ORIGIN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  manual:         { bg: "bg-muted",           text: "text-muted-foreground", label: "Manuale" },
  ai_auto:        { bg: "bg-primary/20",      text: "text-primary",          label: "AI Auto" },
  ai_approved:    { bg: "bg-green-500/20",    text: "text-green-400",        label: "Approvata" },
  ai_rejected:    { bg: "bg-destructive/20",  text: "text-destructive",      label: "Rifiutata" },
  ai_modified:    { bg: "bg-yellow-500/20",   text: "text-yellow-400",       label: "Modificata" },
  system_cron:    { bg: "bg-orange-500/20",   text: "text-orange-400",       label: "Cron" },
  system_trigger: { bg: "bg-blue-500/20",     text: "text-blue-400",         label: "Sistema" },
};

const ACTOR_ICONS: Record<string, React.ReactNode> = {
  user:     <User className="h-4 w-4 text-blue-400" />,
  ai_agent: <Brain className="h-4 w-4 text-primary" />,
  system:   <Cog className="h-4 w-4 text-muted-foreground" />,
  cron:     <Clock className="h-4 w-4 text-orange-400" />,
};

const PAGE_SIZE = 50;

// ── Component ──

export function SupervisorFeedPanel(): React.ReactElement {
  const [actorFilter, setActorFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  // KPI query (today)
  const { data: kpis } = useQuery({
    queryKey: queryKeys.supervisor.kpis,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supervisor_audit_log")
        .select("decision_origin", { count: "exact" })
        .gte("created_at", todayStart);
      if (error) throw error;
      const rows = (data || []) as { decision_origin: string }[];
      return {
        total: rows.length,
        aiAuto: rows.filter((r) => r.decision_origin === "ai_auto").length,
        approved: rows.filter((r) => r.decision_origin === "ai_approved").length,
        manual: rows.filter((r) => r.decision_origin === "manual").length,
      };
    },
    refetchInterval: 30000,
  });

  // Feed query
  const { data: feed, isLoading } = useQuery({
    queryKey: queryKeys.supervisor.feed(actorFilter, originFilter, search, page),
    queryFn: async () => {
      let q = supabase
        .from("supervisor_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actorFilter !== "all") q = q.eq("actor_type", actorFilter);
      if (originFilter !== "all") q = q.eq("decision_origin", originFilter);
      if (search.trim()) {
        q = q.or(`email_address.ilike.%${search}%,action_detail.ilike.%${search}%,target_label.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditRow[];
    },
    refetchInterval: 15000,
  });

  const loadMore = useCallback(() => setPage((p) => p + 1), []);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Azioni Oggi" value={kpis?.total ?? 0} />
        <KpiCard label="AI Auto" value={kpis?.aiAuto ?? 0} color="text-primary" />
        <KpiCard label="Approvate Utente" value={kpis?.approved ?? 0} color="text-green-400" />
        <KpiCard label="Manuali" value={kpis?.manual ?? 0} color="text-muted-foreground" />
      </div>

      {/* Filter Bar + View Toggle */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli attori</SelectItem>
              <SelectItem value="user">Utente</SelectItem>
              <SelectItem value="ai_agent">AI Agent</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
              <SelectItem value="cron">Cron</SelectItem>
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le origini</SelectItem>
              <SelectItem value="manual">Manuale</SelectItem>
              <SelectItem value="ai_auto">AI Automatica</SelectItem>
              <SelectItem value="ai_approved">AI Approvata</SelectItem>
              <SelectItem value="ai_rejected">AI Rifiutata</SelectItem>
              <SelectItem value="ai_modified">AI Modificata</SelectItem>
              <SelectItem value="system_cron">Cron</SelectItem>
              <SelectItem value="system_trigger">Sistema</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca email o partner..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="h-8 pl-7 text-xs"
            />
          </div>

          {/* View toggle */}
          <div className="flex gap-1 ml-auto">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2"
              onClick={() => { setViewMode("cards"); setPage(0); }}
              title="Visualizzazione a schede"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2"
              onClick={() => { setViewMode("table"); setPage(0); }}
              title="Visualizzazione a tabella"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Feed - Card or Table View */}
      {viewMode === "cards" ? (
        <ScrollArea className="h-[calc(100vh-430px)]">
          <div className="space-y-2">
            {isLoading && (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {!isLoading && (!feed || feed.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Nessuna azione registrata.</p>
                <p className="text-xs">Il supervisore è in ascolto di tutte le operazioni.</p>
              </div>
            )}
            {feed?.map((entry) => <AuditCard key={entry.id} entry={entry} />)}
            {feed && feed.length === PAGE_SIZE && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={loadMore}>
                Carica altri…
              </Button>
            )}
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="h-[calc(100vh-430px)] border border-border/50 rounded-lg bg-card/40">
          <AuditTableView feed={feed} isLoading={isLoading} onLoadMore={loadMore} canLoadMore={feed?.length === PAGE_SIZE} />
        </ScrollArea>
      )}
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
}

function AuditCard({ entry }: { entry: AuditRow }) {
  const originStyle = ORIGIN_COLORS[entry.decision_origin] || ORIGIN_COLORS.manual;

  return (
    <Collapsible>
      <div className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-lg px-3 py-2.5 hover:border-border/60 transition-colors">
        <div className="flex items-start gap-3">
          {/* Actor icon */}
          <div className="mt-0.5 shrink-0">
            {ACTOR_ICONS[entry.actor_type] || <Cog className="h-4 w-4" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-snug">
              {entry.actor_name && <span className="font-medium text-primary">{entry.actor_name}</span>}
              {entry.actor_name && " — "}
              {entry.action_detail}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {entry.target_label && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{entry.target_label}</span>
              )}
              {entry.email_address && (
                <span className="text-xs text-muted-foreground font-mono">{entry.email_address}</span>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={`${originStyle.bg} ${originStyle.text} border-0 text-[10px]`}>
              {originStyle.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: it })}
            </span>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <ChevronDown className="h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t border-border/30 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <span>Categoria: <span className="text-foreground">{entry.action_category}</span></span>
              <span>Attore: <span className="text-foreground">{entry.actor_type}</span></span>
              {entry.target_type && <span>Target: <span className="text-foreground">{entry.target_type}</span></span>}
              {entry.partner_id && (
                <span className="flex items-center gap-1">
                  Partner: <ExternalLink className="h-3 w-3 inline" />
                </span>
              )}
            </div>
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <pre className="bg-background/50 rounded p-2 text-[10px] text-muted-foreground overflow-x-auto max-h-32">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            )}
            {entry.ai_decision_log_id && (
              <p className="text-[10px] text-primary">
                🔗 Collegato a Decision Log: {entry.ai_decision_log_id.slice(0, 8)}…
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Table View Component ──

interface AuditTableViewProps {
  feed: AuditRow[] | undefined;
  isLoading: boolean;
  onLoadMore: () => void;
  canLoadMore: boolean;
}

function AuditTableView({ feed, isLoading, onLoadMore, canLoadMore }: AuditTableViewProps) {
  return (
    <div className="w-full">
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {!isLoading && (!feed || feed.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Nessuna azione registrata.</p>
        </div>
      )}
      {!isLoading && feed && feed.length > 0 && (
        <>
          <Table className="text-xs">
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 px-3 py-1.5 text-[11px] font-semibold">Ora</TableHead>
                <TableHead className="h-9 px-3 py-1.5 text-[11px] font-semibold">Attore</TableHead>
                <TableHead className="h-9 px-3 py-1.5 text-[11px] font-semibold">Categoria</TableHead>
                <TableHead className="h-9 px-3 py-1.5 text-[11px] font-semibold">Dettagli</TableHead>
                <TableHead className="h-9 px-3 py-1.5 text-[11px] font-semibold">Target</TableHead>
                <TableHead className="h-9 px-3 py-1.5 text-[11px] font-semibold">Origine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feed.map((entry) => {
                const originStyle = ORIGIN_COLORS[entry.decision_origin] || ORIGIN_COLORS.manual;
                const actorColor = entry.actor_type === "ai_agent" ? "text-primary" :
                                   entry.actor_type === "user" ? "text-blue-400" :
                                   entry.actor_type === "system" ? "text-muted-foreground" :
                                   "text-orange-400";

                return (
                  <Collapsible key={entry.id} asChild>
                    <>
                      <TableRow className="hover:bg-muted/30 cursor-pointer">
                        <TableCell className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(entry.created_at), "HH:mm:ss")}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{ACTOR_ICONS[entry.actor_type] || <Cog className="h-3 w-3" />}</span>
                            <span className={`text-[10px] font-medium truncate ${actorColor}`}>
                              {entry.actor_name || entry.actor_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-[10px] text-muted-foreground">
                          {entry.action_category}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-[10px] text-foreground truncate max-w-xs">
                          {entry.action_detail}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-[10px] text-muted-foreground truncate max-w-xs">
                          {entry.target_label || entry.target_type || "-"}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge className={`${originStyle.bg} ${originStyle.text} border-0 text-[9px]`}>
                            {originStyle.label}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/20 hover:bg-muted/30">
                          <TableCell colSpan={6} className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                              <div className="grid grid-cols-3 gap-3 text-muted-foreground">
                                {entry.email_address && (
                                  <div><span className="font-medium">Email:</span> <span className="text-foreground font-mono">{entry.email_address}</span></div>
                                )}
                                {entry.target_type && (
                                  <div><span className="font-medium">Tipo Target:</span> <span className="text-foreground">{entry.target_type}</span></div>
                                )}
                                {entry.partner_id && (
                                  <div><span className="font-medium">Partner ID:</span> <span className="text-foreground font-mono">{entry.partner_id.slice(0, 8)}…</span></div>
                                )}
                              </div>
                              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Metadata:</p>
                                  <pre className="bg-background/50 rounded p-2 text-[9px] text-muted-foreground overflow-x-auto max-h-40">
                                    {JSON.stringify(entry.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>

          {canLoadMore && (
            <div className="flex justify-center py-3 border-t border-border/30">
              <Button variant="ghost" size="sm" className="text-xs" onClick={onLoadMore}>
                Carica altri…
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
