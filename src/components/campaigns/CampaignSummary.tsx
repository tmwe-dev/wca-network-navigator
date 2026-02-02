import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCountryFlag } from "@/lib/countries";
import { X, Mail, Users, Send } from "lucide-react";

interface Partner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
}

interface CampaignSummaryProps {
  selectedPartners: Partner[];
  onRemovePartner: (partnerId: string) => void;
  onClearAll: () => void;
  onGenerateEmail: () => void;
}

export function CampaignSummary({
  selectedPartners,
  onRemovePartner,
  onClearAll,
  onGenerateEmail,
}: CampaignSummaryProps) {
  // Group by country
  const groupedByCountry = selectedPartners.reduce((acc, partner) => {
    const country = partner.country_name;
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(partner);
    return acc;
  }, {} as Record<string, Partner[]>);

  const countries = Object.keys(groupedByCountry);
  const totalWithEmail = selectedPartners.filter(p => p.email).length;

  if (selectedPartners.length === 0) {
    return (
      <div className="h-full flex flex-col space-panel-emerald animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="p-4 border-b border-emerald-500/20">
          <h3 className="font-semibold flex items-center gap-2 text-emerald-400">
            <Send className="w-5 h-5 text-emerald-500" />
            Riepilogo Campagna
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-emerald-500/30" />
            <p className="text-slate-400">Seleziona aziende dal pannello a sinistra</p>
            <p className="text-sm mt-1 text-slate-500">per aggiungerle alla campagna</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-panel-emerald animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="p-4 border-b border-emerald-500/20">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-emerald-400">
            <Send className="w-5 h-5 text-emerald-500" />
            Riepilogo Campagna
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearAll}
            className="text-slate-400 hover:text-slate-300 hover:bg-emerald-500/10"
          >
            Svuota tutto
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="space-stat-card">
            <div className="text-2xl font-mono font-bold text-amber-400">{selectedPartners.length}</div>
            <div className="text-xs text-slate-400">Aziende</div>
          </div>
          <div className="space-stat-card">
            <div className="text-2xl font-mono font-bold text-amber-400">{countries.length}</div>
            <div className="text-xs text-slate-400">Paesi</div>
          </div>
          <div className="space-stat-card">
            <div className="text-2xl font-mono font-bold text-emerald-400">{totalWithEmail}</div>
            <div className="text-xs text-slate-400">Con email</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {countries.map(country => (
            <div key={country}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {getCountryFlag(groupedByCountry[country][0].country_code)}
                </span>
                <span className="font-medium text-sm text-slate-200">{country}</span>
                <Badge className="ml-auto space-badge">
                  {groupedByCountry[country].length}
                </Badge>
              </div>
              <div className="space-y-1 pl-7">
                {groupedByCountry[country].map(partner => (
                  <div 
                    key={partner.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-emerald-500/10 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-slate-200">{partner.company_name}</p>
                      <p className="text-xs text-slate-500">{partner.city}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {partner.email && (
                        <Mail className="w-3 h-3 text-emerald-500/60" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => onRemovePartner(partner.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-emerald-500/20 space-y-2">
        <Button 
          onClick={onGenerateEmail} 
          className="w-full space-button-primary"
          disabled={totalWithEmail === 0}
        >
          <Mail className="w-4 h-4 mr-2" />
          Genera Email ({totalWithEmail} destinatari)
        </Button>
        {totalWithEmail < selectedPartners.length && (
          <p className="text-xs text-slate-500 text-center">
            {selectedPartners.length - totalWithEmail} aziende senza email verranno escluse
          </p>
        )}
      </div>
    </div>
  );
}
