/**
 * CampagneTab.
 * @deprecated 2026-04-30 — Non incluso in OutreachPage da tempo (dead code).
 * Le campagne sono visibili in /v2/explore/campaigns e nel CampaignQueueMonitor
 * dentro il Command Canvas. Mantenuto in archivio (regola: no delete in src/components/).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Clock, CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { queryKeys } from "@/lib/queryKeys";

type QueueFilter = "all" | "pending" | "sent" | "failed";

export function CampagneTab() {
  const [filter, setFilter] = useState<QueueFilter>("all");

  const { data: campaignJobs, isLoading: jobsLoading } = useQuery({
    queryKey: queryKeys.campaigns.jobsOutreach(),
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: emailQueue, isLoading: queueLoading } = useQuery({
    queryKey: queryKeys.email.queueOutreach(),
    queryFn: async () => {
      const { data } = await supabase
        .from("email_campaign_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const isLoading = jobsLoading || queueLoading;
  const allItems = emailQueue || [];
  const filtered = filter === "all" ? allItems : allItems.filter(e => e.status === filter);

  const stats = {
    total: allItems.length,
    pending: allItems.filter(e => e.status === "pending").length,
    sent: allItems.filter(e => e.status === "sent").length,
    failed: allItems.filter(e => e.status === "failed" || e.status === "error").length,
  };

  const jobStats = {
    total: (campaignJobs || []).length,
    pending: (campaignJobs || []).filter(j => j.status === "pending").length,
    completed: (campaignJobs || []).filter(j => j.status === "completed").length,
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Send className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Coda Email</p>
            <p className="text-lg font-bold">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">In attesa</p>
            <p className="text-lg font-bold">{stats.pending}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inviate</p>
            <p className="text-lg font-bold">{stats.sent}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Errori</p>
            <p className="text-lg font-bold">{stats.failed}</p>
          </div>
        </Card>
      </div>

      {/* Campaign Jobs summary */}
      {jobStats.total > 0 && (
        <Card className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Campaign Jobs</p>
          <div className="flex gap-4 text-sm">
            <span>Totali: <strong>{jobStats.total}</strong></span>
            <span className="text-warning">Pending: {jobStats.pending}</span>
            <span className="text-success">Completati: {jobStats.completed}</span>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as QueueFilter)} className="shrink-0">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="text-xs">Tutte ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="sent" className="text-xs">Inviate ({stats.sent})</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">Errori ({stats.failed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nessuna email in coda
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <Card key={item.id} className="p-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.recipient_name || item.recipient_email}
                  </p>
                </div>
                <Badge
                  variant={
                    item.status === "sent" ? "default" :
                    item.status === "pending" ? "secondary" :
                    "destructive"
                  }
                  className="text-[10px] flex-shrink-0"
                >
                  {item.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {format(new Date(item.created_at), "dd MMM HH:mm", { locale: it })}
                </span>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
