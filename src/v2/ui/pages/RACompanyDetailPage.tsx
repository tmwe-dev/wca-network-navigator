/**
 * RACompanyDetailPage — Single RA company detail
 */
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useProspectsV2 } from "@/v2/hooks/useProspectsV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Phone, Mail, Globe, TrendingUp, Users } from "lucide-react";

export function RACompanyDetailPage(): React.ReactElement {
  const [params] = useSearchParams();
  const prospectId = params.get("id");
  const { data: prospects } = useProspectsV2();
  const prospect = (prospects ?? []).find((p) => p.id === prospectId);

  if (!prospect) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Azienda non trovata
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5" /> {prospect.companyName}
        </h1>
        <p className="text-xs text-muted-foreground">{prospect.codiceAteco} — {prospect.descrizioneAteco}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">KPI Finanziari</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Fatturato: €{prospect.fatturato?.toLocaleString() ?? "N/A"}</div>
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Dipendenti: {prospect.dipendenti ?? "N/A"}</div>
            <div>Utile: €{prospect.utile?.toLocaleString() ?? "N/A"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Contatti</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {prospect.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {prospect.phone}</div>}
            {prospect.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {prospect.email}</div>}
            {prospect.pec && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> PEC: {prospect.pec}</div>}
            {prospect.website && <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> {prospect.website}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Localizzazione</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {prospect.address}</div>
            <div>{prospect.city}, {prospect.province} {prospect.cap}</div>
            <div>{prospect.region}</div>
            <Badge>{prospect.leadStatus}</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
