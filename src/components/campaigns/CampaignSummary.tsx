import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCountryFlag } from "@/lib/countries";
import { X, Mail, Users, Globe, Send } from "lucide-react";

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
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5" />
            Riepilogo Campagna
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Seleziona aziende dal pannello a sinistra</p>
            <p className="text-sm mt-1">per aggiungerle alla campagna</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5" />
            Riepilogo Campagna
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Svuota tutto
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{selectedPartners.length}</div>
            <div className="text-xs text-muted-foreground">Aziende</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{countries.length}</div>
            <div className="text-xs text-muted-foreground">Paesi</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-success">{totalWithEmail}</div>
            <div className="text-xs text-muted-foreground">Con email</div>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 pb-4">
          {countries.map(country => (
            <div key={country}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {getCountryFlag(groupedByCountry[country][0].country_code)}
                </span>
                <span className="font-medium text-sm">{country}</span>
                <Badge variant="secondary" className="ml-auto">
                  {groupedByCountry[country].length}
                </Badge>
              </div>
              <div className="space-y-1 pl-7">
                {groupedByCountry[country].map(partner => (
                  <div 
                    key={partner.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{partner.company_name}</p>
                      <p className="text-xs text-muted-foreground">{partner.city}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {partner.email && (
                        <Mail className="w-3 h-3 text-muted-foreground" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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

      <div className="p-4 border-t space-y-2">
        <Button 
          onClick={onGenerateEmail} 
          className="w-full"
          disabled={totalWithEmail === 0}
        >
          <Mail className="w-4 h-4 mr-2" />
          Genera Email ({totalWithEmail} destinatari)
        </Button>
        {totalWithEmail < selectedPartners.length && (
          <p className="text-xs text-muted-foreground text-center">
            {selectedPartners.length - totalWithEmail} aziende senza email verranno escluse
          </p>
        )}
      </div>
    </Card>
  );
}
