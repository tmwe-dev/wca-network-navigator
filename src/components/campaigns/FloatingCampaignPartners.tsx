/**
 * FloatingCampaignPartners — Right-side floating list of selected campaign partners
 */
import { Button } from "@/components/ui/button";
import { X, Mail } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { CampaignPartner } from "./useCampaignData";

interface Props {
  campaignPartners: CampaignPartner[];
  onRemoveFromCampaign: (id: string) => void;
  onClearCampaign: () => void;
}

export function FloatingCampaignPartners({ campaignPartners, onRemoveFromCampaign, onClearCampaign }: Props) {
  if (campaignPartners.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="ghost" size="sm" onClick={onClearCampaign} className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 py-1">
        <X className="w-3 h-3 mr-1" />Svuota
      </Button>
      <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {campaignPartners.map((partner) => (
          <div
            key={partner.id}
            className={cn(
              "group flex items-center gap-2 bg-card/50 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-sm",
              partner.has_bca ? "border-primary/40" : "border-emerald-500/30"
            )}
          >
            <span className="text-foreground truncate max-w-40">{partner.company_name}</span>
            <span className="text-muted-foreground text-xs">{getCountryFlag(partner.country_code)}</span>
            {partner.has_bca && <span className="text-[10px]">🤝</span>}
            {partner.email && <Mail className="w-3 h-3 text-emerald-500/60" />}
            <button onClick={() => onRemoveFromCampaign(partner.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
