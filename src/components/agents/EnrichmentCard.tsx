import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Truck, Warehouse, Users, DollarSign, CalendarDays, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EnrichmentCardProps {
  partner: any;
}

export function EnrichmentCard({ partner }: EnrichmentCardProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const enrichment = partner.enrichment_data as any;
  const hasWebsite = !!partner.website;

  const handleEnrich = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-partner-website", {
        body: { partnerId: partner.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Dati arricchiti dal sito web!");
        queryClient.invalidateQueries({ queryKey: ["partner", partner.id] });
      } else {
        toast.error(data?.error || "Errore nell'arricchimento");
      }
    } catch (err: any) {
      console.error("Enrichment error:", err);
      toast.error("Errore durante l'analisi del sito");
    } finally {
      setLoading(false);
    }
  };

  if (!hasWebsite && !enrichment) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Dati dal sito web
          </CardTitle>
          {hasWebsite && (
            <Button variant="outline" size="sm" onClick={handleEnrich} disabled={loading}>
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1" />
              )}
              {enrichment ? "Aggiorna" : "Arricchisci dal sito"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!enrichment ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clicca "Arricchisci dal sito" per estrarre dati dal sito del partner
          </p>
        ) : enrichment.error ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {enrichment.error}
          </p>
        ) : (
          <div className="space-y-3">
            {enrichment.summary_it && (
              <p className="text-sm text-muted-foreground leading-relaxed">{enrichment.summary_it}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {enrichment.founding_year && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span>Fondata nel <strong>{enrichment.founding_year}</strong></span>
                </div>
              )}
              {enrichment.employee_count && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span><strong>{enrichment.employee_count}</strong> dipendenti</span>
                </div>
              )}
              {enrichment.revenue_estimate && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span>{enrichment.revenue_estimate}</span>
                </div>
              )}
              {enrichment.has_own_fleet && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    Flotta propria
                    {enrichment.fleet_details && ` - ${enrichment.fleet_details}`}
                  </span>
                </div>
              )}
              {enrichment.has_warehouses && (
                <div className="flex items-center gap-2 text-sm">
                  <Warehouse className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-700 dark:text-blue-400 font-medium">
                    Magazzini
                    {enrichment.warehouse_sqm && ` - ${enrichment.warehouse_sqm.toLocaleString()} mq`}
                  </span>
                </div>
              )}
            </div>
            {enrichment.key_markets?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mercati principali</p>
                <div className="flex flex-wrap gap-1">
                  {enrichment.key_markets.map((m: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <MapPin className="w-3 h-3 mr-0.5" />
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {enrichment.additional_services?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Servizi aggiuntivi</p>
                <div className="flex flex-wrap gap-1">
                  {enrichment.additional_services.map((s: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {partner.enriched_at && (
              <p className="text-[10px] text-muted-foreground text-right">
                Aggiornato: {new Date(partner.enriched_at).toLocaleDateString("it-IT")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
