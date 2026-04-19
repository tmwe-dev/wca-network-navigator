/**
 * HoldingPatternCommandCenter — shell composing ContactList, ActionBar, MessageThread
 */
import { useState, useCallback } from "react";
import type { Database } from "@/integrations/supabase/types";
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

  const handleApproveResponse = useCallback(async () => {
    if (!selectedMessage || !selectedGroup) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.error("Sessione non valida"); return; }
      const { error } = await supabase.from("activities").insert({
        activity_type: "send_email" as Database["public"]["Enums"]["activity_type"],
        title: `Risposta approvata: ${selectedMessage.subject || "Senza oggetto"}`,
        description: `Risposta al messaggio da ${selectedMessage.from_address}`,
        source_id: selectedMessage.id,
        source_type: "holding_pattern_approval",
        status: "pending" as Database["public"]["Enums"]["activity_status"],
        priority: "medium",
        user_id: session.user.id,
        partner_id: selectedGroup.partnerId || null,
      });
      if (error) throw error;
      toast.success("Risposta approvata e accodata per l'invio");
    } catch { toast.error("Errore nell'approvazione della risposta"); }
  }, [selectedMessage, selectedGroup]);

  const handleIgnore = useCallback(async () => {
    if (!selectedMessage) return;
    try {
      const { error } = await supabase.from("channel_messages").update({ category: "ignored" }).eq("id", selectedMessage.id);
      if (error) throw error;
      toast.info("Messaggio contrassegnato come ignorato");
    } catch { toast.error("Errore nell'aggiornamento"); }
  }, [selectedMessage]);

  const handlePhoneEscalation = useCallback(async () => {
    if (!selectedMessage || !selectedGroup) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { toast.error("Sessione non valida"); return; }
      const { error } = await supabase.from("activities").insert({
        activity_type: "phone_call" as Database["public"]["Enums"]["activity_type"],
        title: `Escalation telefonica: ${selectedGroup.companyName}`,
        description: `Escalation da email ${selectedMessage.from_address} — ${selectedMessage.subject || "Senza oggetto"}`,
        source_id: selectedMessage.id,
        source_type: "holding_pattern_escalation",
        status: "pending" as Database["public"]["Enums"]["activity_status"],
        priority: "high",
        user_id: session.user.id,
        partner_id: selectedGroup.partnerId || null,
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
