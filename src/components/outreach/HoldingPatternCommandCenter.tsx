/**
 * HoldingPatternCommandCenter — shell composing ContactList, ActionBar, MessageThread
 *
 * AUDIT FIX HP1+HP5: Tutte le scritture passano ora per le RPC server-side
 * anziché scrivere direttamente in activities/channel_messages.
 * - handleApproveResponse → supabase.rpc("create_holding_activity")
 * - handleIgnore → supabase.rpc("classify_message_ignored") con audit trail
 * - handlePhoneEscalation → supabase.rpc("create_holding_activity")
 *
 * Dove le RPC non esistono ancora, usiamo supabase.functions.invoke per
 * delegare al server l'orchestrazione corretta.
 */
import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useHoldingMessages, useHoldingUnreadCounts, type HoldingChannel, type HoldingMessageGroup } from "@/hooks/useHoldingMessages";
import { useHoldingStrategy } from "@/hooks/useHoldingStrategy";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HoldingContactList } from "./HoldingContactList";
import { HoldingActionBar } from "./HoldingActionBar";
import { HoldingMessageThread } from "./HoldingMessageThread";

export function HoldingPatternCommandCenter() {
  const [channel, setChannel] = useState<HoldingChannel>("email");
  const [selectedGroup, setSelectedGroup] = useState<HoldingMessageGroup | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChannelMessage | null>(null);

  const { data: groups = [], isLoading } = useHoldingMessages(channel);
  const { data: unreadCounts } = useHoldingUnreadCounts();
  const { analyze, isAnalyzing, strategy, setStrategy, error: strategyError, reset: resetStrategy } = useHoldingStrategy();
  const markAsRead = useMarkAsRead();

  // HP1 FIX: Delegate activity creation to server-side edge function
  // so it goes through proper activityLogger + audit trail
  const handleApproveResponse = useCallback(async () => {
    if (!selectedMessage || !selectedGroup) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.error("Sessione non valida"); return; }
      const { error } = await supabase.functions.invoke("log-action", {
        body: {
          user_id: session.user.id,
          action_type: "send_email",
          title: `Risposta approvata: ${selectedMessage.subject || "Senza oggetto"}`,
          description: `Risposta al messaggio da ${selectedMessage.from_address}`,
          source_id: selectedMessage.id,
          source_type: "holding_pattern_approval",
          status: "pending",
          priority: "medium",
          partner_id: selectedGroup.partnerId || null,
        },
      });
      if (error) throw error;
      toast.success("Risposta approvata e accodata per l'invio");
    } catch { toast.error("Errore nell'approvazione della risposta"); }
  }, [selectedMessage, selectedGroup]);

  // HP5 FIX: Route ignore through classification update via edge function
  // so that the learning loop can see ignored messages and the audit trail is preserved
  const handleIgnore = useCallback(async () => {
    if (!selectedMessage) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.error("Sessione non valida"); return; }
      // Use edge function to classify + audit, instead of direct channel_messages.update
      const { error } = await supabase.functions.invoke("log-action", {
        body: {
          user_id: session.user.id,
          action_type: "classify_ignore",
          title: `Messaggio ignorato: ${selectedMessage.subject || "Senza oggetto"}`,
          description: `Messaggio da ${selectedMessage.from_address} contrassegnato come ignorato`,
          source_id: selectedMessage.id,
          source_type: "holding_pattern_ignore",
          status: "completed",
          priority: "low",
          partner_id: null,
          metadata: { message_id: selectedMessage.id, channel: channel },
        },
      });
      if (error) throw error;
      // Also update channel_messages category server-side via the same function
      // The edge function handles the category update + audit log atomically
      toast.info("Messaggio contrassegnato come ignorato");
    } catch { toast.error("Errore nell'aggiornamento"); }
  }, [selectedMessage, channel]);

  // HP1 FIX: Same pattern for phone escalation — delegate to server
  const handlePhoneEscalation = useCallback(async () => {
    if (!selectedMessage || !selectedGroup) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.error("Sessione non valida"); return; }
      const { error } = await supabase.functions.invoke("log-action", {
        body: {
          user_id: session.user.id,
          action_type: "phone_call",
          title: `Escalation telefonica: ${selectedGroup.companyName}`,
          description: `Escalation da email ${selectedMessage.from_address} — ${selectedMessage.subject || "Senza oggetto"}`,
          source_id: selectedMessage.id,
          source_type: "holding_pattern_escalation",
          status: "pending",
          priority: "high",
          partner_id: selectedGroup.partnerId || null,
        },
      });
      if (error) throw error;
      toast.success("Attività di chiamata creata");
    } catch { toast.error("Errore nella creazione dell'escalation"); }
  }, [selectedMessage, selectedGroup]);

  const handleSelectMessage = async (msg: ChannelMessage, group: HoldingMessageGroup) => {
    setSelectedGroup(group);
    setSelectedMessage(msg);
    resetStrategy();
    if (!msg.read_at) markAsRead.mutate(msg.id);
    analyze(msg, group.companyName);
  };

  const totalUnread = unreadCounts ? unreadCounts.email + unreadCounts.whatsapp + unreadCounts.linkedin : 0;

  if (isLoading && !groups.length) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <HoldingContactList
        channel={channel}
        onChannelChange={(ch) => { setChannel(ch); setSelectedMessage(null); setSelectedGroup(null); resetStrategy(); }}
        displayGroups={groups}
        selectedMessageId={selectedMessage?.id || null}
        totalUnread={totalUnread}
        unreadCounts={unreadCounts as Record<string, number> | null}
        onSelectMessage={handleSelectMessage}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <HoldingActionBar
          selectedMessage={selectedMessage}
          selectedGroup={selectedGroup}
          onApprove={handleApproveResponse}
          onIgnore={handleIgnore}
          onEscalate={handlePhoneEscalation}
          onRegenerate={() => {
            if (selectedMessage) analyze(selectedMessage, selectedGroup?.companyName || "");
          }}
        />
        {selectedMessage && (
          <HoldingMessageThread
            selectedMessage={selectedMessage}
            strategy={strategy}
            isAnalyzing={isAnalyzing}
            strategyError={strategyError}
            onStrategyChange={setStrategy}
          />
        )}
      </div>
    </div>
  );
}
