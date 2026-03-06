import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Globe, Users, Briefcase } from "lucide-react";

interface CountryOption {
  code: string;
  name: string;
  count: number;
}

interface PartnerOption {
  id: string;
  company_name: string;
  country_name: string;
  city: string;
  email: string | null;
}

interface BatchOption {
  id: string;
  date: string;
}

interface RecipientSelectorProps {
  recipientTab: string;
  onRecipientTabChange: (tab: string) => void;
  countries: CountryOption[];
  selectedCountries: string[];
  onToggleCountry: (name: string) => void;
  filteredPartners: PartnerOption[];
  selectedPartnerIds: string[];
  onTogglePartner: (id: string) => void;
  partnerSearch: string;
  onPartnerSearchChange: (search: string) => void;
  batches: BatchOption[];
  selectedBatchId: string | null;
  onSelectBatch: (id: string | null) => void;
  recipientCount: number;
  recipientWithEmailCount: number;
}

export function RecipientSelector({
  recipientTab,
  onRecipientTabChange,
  countries,
  selectedCountries,
  onToggleCountry,
  filteredPartners,
  selectedPartnerIds,
  onTogglePartner,
  partnerSearch,
  onPartnerSearchChange,
  batches,
  selectedBatchId,
  onSelectBatch,
  recipientCount,
  recipientWithEmailCount,
}: RecipientSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-5 h-5" /> Destinatari
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={recipientTab} onValueChange={onRecipientTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="country" className="flex-1 gap-1">
              <Globe className="w-3 h-3" /> Paese
            </TabsTrigger>
            <TabsTrigger value="partner" className="flex-1 gap-1">
              <Users className="w-3 h-3" /> Partner
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex-1 gap-1">
              <Briefcase className="w-3 h-3" /> Campagna
            </TabsTrigger>
          </TabsList>

          <TabsContent value="country">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {countries.map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/50 px-2 rounded">
                    <Checkbox
                      checked={selectedCountries.includes(c.name)}
                      onCheckedChange={() => onToggleCountry(c.name)}
                    />
                    <span className="flex-1">{c.name}</span>
                    <Badge variant="secondary" className="text-xs">{c.count}</Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="partner">
            <Input
              placeholder="Cerca partner..."
              value={partnerSearch}
              onChange={(e) => onPartnerSearchChange(e.target.value)}
              className="mb-2"
            />
            <ScrollArea className="h-[360px]">
              <div className="space-y-1">
                {filteredPartners.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/50 px-2 rounded">
                    <Checkbox
                      checked={selectedPartnerIds.includes(p.id)}
                      onCheckedChange={() => onTogglePartner(p.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{p.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.city}, {p.country_name}</p>
                    </div>
                    {p.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="batch">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {batches.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nessuna campagna trovata</p>
                )}
                {batches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/50 px-2 rounded">
                    <Checkbox
                      checked={selectedBatchId === b.id}
                      onCheckedChange={() => onSelectBatch(selectedBatchId === b.id ? null : b.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-mono text-xs">{b.id.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.date).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Selezionati</span>
            <Badge>{recipientCount}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span>Con email valida</span>
            <Badge variant={recipientWithEmailCount > 0 ? "default" : "destructive"}>
              {recipientWithEmailCount}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
