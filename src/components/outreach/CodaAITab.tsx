import { useState } from "react";
import { sanitizeHtml } from "@/lib/security/htmlSanitizer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Eye, Bot, Loader2, RefreshCw, Clock, Mail, MessageCircle, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useOutreachMock } from "@/hooks/useOutreachMock";
import { MOCK_AGENT_ACTIONS } from "@/lib/outreachMockData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { approveActivity } from "@/data/activities";

interface AgentAction {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  email_subject: string | null;
  email_body: string | null;
  partner_id: string | null;
  executed_by_agent_id: string | null;
  created_at: string;
  status: string;
  priority: string;
  source_meta: Record<string, any>;
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp_message: MessageCircle,
  linkedin_message: Linkedin,
};

export function CodaAITab() {
  const queryClient = useQueryClient();
  const [previewAction, setPreviewAction] = useState<AgentAction | null>(null);
  const { mockEnabled } = useOutreachMock();

  const { data: pendingActions = [], isLoading } = useQuery({
    queryKey: ["agent-pending-actions"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return [];
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("status", "pending")
        .not("executed_by_agent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as AgentAction[];
    },
    refetchInterval: 30000,
    enabled: !mockEnabled,
  });

  const displayActions = mockEnabled ? (MOCK_AGENT_ACTIONS as any as AgentAction[]) : pendingActions;

  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      if (mockEnabled) return;
      const { error } = await supabase
        .from("activities")
        .update({ status: "approved", reviewed: true })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-pending-actions"] });
      toast.success("Azione approvata e messa in coda");
    },
  });

  const rejectAction = useMutation({
    mutationFn: async (actionId: string) => {
      if (mockEnabled) return;
      const { error } = await supabase
        .from("activities")
        .update({ status: "cancelled", reviewed: true })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-pending-actions"] });
      toast.info("Azione rifiutata");
    },
  });

  const approveAll = useMutation({
    mutationFn: async () => {
      if (mockEnabled) return;
      const ids = pendingActions.map(a => a.id);
      for (const id of ids) {
        await approveActivity(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-pending-actions"] });
      toast.success(`${displayActions.length} azioni approvate`);
    },
  });

  const getChannelIcon = (type: string) => {
    const Icon = CHANNEL_ICONS[type] || Bot;
    return <Icon className="w-3.5 h-3.5" />;
  };

  if (isLoading && !mockEnabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Coda AI</span>
          {displayActions.length > 0 && (
            <Badge variant="secondary" className="text-xs">{displayActions.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displayActions.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => approveAll.mutate()}
              disabled={approveAll.isPending}
            >
              <Check className="w-3 h-3" /> Approva tutti
            </Button>
          )}
          <Button
            size="icon" aria-label="Azione"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["agent-pending-actions"] })}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* List */}
      {displayActions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nessuna azione in attesa</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Le azioni proposte dagli agenti AI appariranno qui per la tua approvazione.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-3 py-2">
          <div className="space-y-2">
            {displayActions.map(action => (
              <div
                key={action.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors bg-card"
              >
                <div className="shrink-0 mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                  {getChannelIcon(action.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{action.title}</p>
                  {action.email_subject && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      Oggetto: {action.email_subject}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{action.activity_type}</Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {format(new Date(action.created_at), "dd MMM HH:mm", { locale: it })}
                    </span>
                    {action.priority === "high" && (
                      <Badge variant="destructive" className="text-[10px]">Urgente</Badge>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <Button size="icon" aria-label="Visualizza" variant="ghost" className="h-7 w-7" onClick={() => setPreviewAction(action)} title="Anteprima">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" aria-label="Conferma" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => approveAction.mutate(action.id)} disabled={approveAction.isPending} title="Approva">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" aria-label="Rifiuta" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => rejectAction.mutate(action.id)} disabled={rejectAction.isPending} title="Rifiuta">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewAction} onOpenChange={o => !o && setPreviewAction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {previewAction && getChannelIcon(previewAction.activity_type)}
              {previewAction?.title}
            </DialogTitle>
          </DialogHeader>
          {previewAction && (
            <div className="space-y-3">
              {previewAction.email_subject && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Oggetto</p>
                  <p className="text-sm">{previewAction.email_subject}</p>
                </div>
              )}
              {previewAction.email_body && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Contenuto</p>
                  <div
                    className="text-sm border rounded-lg p-3 max-h-[300px] overflow-auto bg-muted/20"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewAction.email_body) }}
                  />
                </div>
              )}
              {previewAction.description && !previewAction.email_body && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Descrizione</p>
                  <p className="text-sm">{previewAction.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { rejectAction.mutate(previewAction!.id); setPreviewAction(null); }}>
              <X className="w-3 h-3 mr-1" /> Rifiuta
            </Button>
            <Button size="sm" onClick={() => { approveAction.mutate(previewAction!.id); setPreviewAction(null); }}>
              <Check className="w-3 h-3 mr-1" /> Approva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
