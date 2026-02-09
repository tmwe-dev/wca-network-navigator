import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList, X, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onAssignActivity: () => void;
  partnerIds: string[];
}

export function BulkActionBar({ count, onClear, onAssignActivity, partnerIds }: BulkActionBarProps) {
  const [deepSearching, setDeepSearching] = useState(false);
  const queryClient = useQueryClient();

  if (count === 0) return null;

  const handleBulkDeepSearch = async () => {
    setDeepSearching(true);
    let totalLinks = 0;
    let totalLogos = 0;
    let errors = 0;

    for (const partnerId of partnerIds) {
      try {
        const { data, error } = await supabase.functions.invoke('deep-search-partner', {
          body: { partnerId },
        });
        if (error || !data?.success) {
          errors++;
          console.error(`Deep search failed for ${partnerId}:`, error || data?.error);
        } else {
          totalLinks += data.socialLinksFound || 0;
          if (data.logoFound) totalLogos++;
        }
      } catch {
        errors++;
      }
      // Small delay between requests
      await new Promise(r => setTimeout(r, 1000));
    }

    queryClient.invalidateQueries({ queryKey: ['partners'] });
    queryClient.invalidateQueries({ queryKey: ['social-links'] });

    toast.success(
      `Deep Search completata su ${partnerIds.length} agenti: ${totalLinks} link social, ${totalLogos} loghi${errors > 0 ? `, ${errors} errori` : ''}`
    );
    setDeepSearching(false);
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <span className="text-sm font-semibold whitespace-nowrap">
        {count} agente{count !== 1 ? "i" : ""} selezionat{count !== 1 ? "i" : "o"}
      </span>
      <div className="h-5 w-px bg-primary-foreground/30" />
      <Button
        variant="secondary"
        size="sm"
        className="h-8 text-xs"
        onClick={onAssignActivity}
      >
        <ClipboardList className="w-3.5 h-3.5 mr-1" />
        Assegna Attività
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-8 text-xs"
        onClick={handleBulkDeepSearch}
        disabled={deepSearching}
      >
        {deepSearching ? (
          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 mr-1" />
        )}
        {deepSearching ? "Ricerca..." : "Deep Search"}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
