/**
 * BCASmartActions — Deep Search, LinkedIn, Campaign for BCA detail
 */
import { useCallback } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Button } from "@/components/ui/button";
import { Search, Linkedin, Megaphone, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface Props {
  card: BusinessCardWithPartner;
}

export function BCASmartActions({ card }: Props) {
  const navigate = useAppNavigate();

  const handleCockpitWithContext = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await insertCockpitQueueItems([{
        source_id: card.id,
        source_type: "business_card",
        user_id: user.id,
        partner_id: card.matched_partner_id || null,
      }]);
      toast({ title: "✅ Inviato al Cockpit", description: card.event_name ? `Con contesto: ${card.event_name}` : undefined });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
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
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
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
    navigate("/email-composer", {
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

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Azioni intelligenti</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10 justify-start" onClick={handleCockpitWithContext}>
          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Cockpit</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10 justify-start" onClick={handleDeepSearch}>
          <Search className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Deep Search</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-blue-500/15 hover:bg-blue-500/10 justify-start" onClick={handleLinkedIn}>
          <Linkedin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">LinkedIn</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-amber-500/15 hover:bg-amber-500/10 justify-start" onClick={handleCampaign}>
          <Megaphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">Campagna</span>
        </Button>
      </div>
    </div>
  );
}
