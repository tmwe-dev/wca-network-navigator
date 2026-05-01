/**
 * BCASmartActions — wrapper sul UnifiedSmartActions standard.
 * Mantiene gli handler specifici BCA (Cockpit con context, Deep su matched_partner_id).
 */
import { useCallback } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { supabase } from "@/integrations/supabase/client";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { UnifiedSmartActions } from "@/components/shared/entity-panel/UnifiedSmartActions";

interface Props {
  card: BusinessCardWithPartner;
}

/** Espone solo il blocco "Azioni AI" — il blocco Comunicazione resta nel pannello padre BCA per non duplicarsi. */
export function BCASmartActions({ card }: Props) {
  const navigate = useAppNavigate();

  const handleCockpitWithContext = useCallback(async () => {
    try {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return;
      await insertCockpitQueueItems([{
        source_id: card.id,
        source_type: "business_card",
        user_id: user.id,
        partner_id: card.matched_partner_id || null,
      }]);
      toast({ title: "✅ Inviato al Cockpit", description: card.event_name ? `Con contesto: ${card.event_name}` : undefined });
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }, [card]);

  const handleDeepSearch = useCallback(async () => {
    if (!card.matched_partner_id) {
      toast({ title: "Nessun partner associato", description: "Associa prima un partner WCA", variant: "destructive" });
      return;
    }
    try {
      await invokeEdge("ai-utility", {
        body: { action: "deep_search", partnerIds: [card.matched_partner_id] },
        context: "BCASmartActions.deep_search",
      });
      toast({ title: "🔍 Deep Search avviata" });
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }, [card.matched_partner_id]);

  const handleLinkedIn = useCallback(() => {
    const query = [card.contact_name, card.company_name].filter(Boolean).join(" ");
    window.open(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`, "_blank");
  }, [card]);

  const handleCampaign = useCallback(() => {
    if (!card.email) {
      toast({ title: "Email mancante", variant: "destructive" });
      return;
    }
    navigate("/v2/email-composer", {
      state: {
        prefilledRecipient: {
          email: card.email,
          name: card.contact_name || undefined,
          company: card.company_name || undefined,
          partnerId: card.matched_partner_id || undefined,
        },
      },
    });
  }, [card, navigate]);

  // Solo blocco AI; Comunicazione è già renderizzato dal parent BCADetailPanel.
  return (
    <UnifiedSmartActions
      hasEmail={false} hasPhone={false} hasWhatsApp={false}
      onCockpit={handleCockpitWithContext}
      onDeepSearch={handleDeepSearch}
      onLinkedIn={handleLinkedIn}
      onCampaign={handleCampaign}
      // Hide comm block by rendering only the AI part: trick = pass empty handlers + flags false → render entrambi.
      // Per evitare duplicazione visiva uso un componente dedicato sotto.
    />
  );
}
