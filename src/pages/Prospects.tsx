import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Search, MapPin, Phone, Mail, Globe, Euro,
  Users, FileText, Loader2, ExternalLink,
} from "lucide-react";
import { useProspects, Prospect } from "@/hooks/useProspects";

const REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia",
  "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function Prospects() {
  const { data: prospects, isLoading } = useProspects();
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Prospect | null>(null);

  const filtered = useMemo(() => {
    if (!prospects) return [];
    return prospects.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.company_name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.partita_iva?.includes(q) ||
        p.codice_ateco?.includes(q);
      const matchRegion = regionFilter === "all" || p.region === regionFilter;
      return matchSearch && matchRegion;
    });
  }, [prospects, search, regionFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-500" /> Prospect
        </h1>
        <p className="text-muted-foreground mt-1">
          Aziende italiane da ReportAziende.it — {prospects?.length ?? 0} totali
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, città, P.IVA, ATECO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Regione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le regioni</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nessun prospect trovato</p>
            <p className="text-sm mt-1">Importa aziende da ReportAziende tramite l'estensione Chrome nelle Impostazioni.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* List */}
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.id === p.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelected(p)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{p.company_name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {p.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}{p.province ? ` (${p.province})` : ""}</span>}
                        {p.codice_ateco && <Badge variant="outline" className="text-[10px] px-1">{p.codice_ateco}</Badge>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {p.fatturato != null && (
                        <span className="text-xs font-medium text-emerald-600">{formatCurrency(p.fatturato)}</span>
                      )}
                      {p.dipendenti != null && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Users className="w-3 h-3" /> {p.dipendenti}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:sticky lg:top-4">
            {selected ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{selected.company_name}</CardTitle>
                  {selected.descrizione_ateco && (
                    <p className="text-sm text-muted-foreground">{selected.descrizione_ateco}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Location */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selected.address && <Detail icon={MapPin} label="Indirizzo" value={`${selected.address}${selected.cap ? `, ${selected.cap}` : ""}`} />}
                    {selected.city && <Detail icon={MapPin} label="Città" value={`${selected.city}${selected.province ? ` (${selected.province})` : ""}`} />}
                    {selected.region && <Detail icon={MapPin} label="Regione" value={selected.region} />}
                  </div>

                  {/* Contact */}
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                    {selected.phone && <Detail icon={Phone} label="Telefono" value={selected.phone} />}
                    {selected.email && <Detail icon={Mail} label="Email" value={selected.email} />}
                    {selected.pec && <Detail icon={Mail} label="PEC" value={selected.pec} />}
                    {selected.website && (
                      <div className="flex items-start gap-2">
                        <Globe className="w-4 h-4 mt-0.5 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Sito Web</p>
                          <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1">
                            {selected.website} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial */}
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                    {selected.fatturato != null && <Detail icon={Euro} label="Fatturato" value={formatCurrency(selected.fatturato)} />}
                    {selected.utile != null && <Detail icon={Euro} label="Utile" value={formatCurrency(selected.utile)} />}
                    {selected.dipendenti != null && <Detail icon={Users} label="Dipendenti" value={String(selected.dipendenti)} />}
                    {selected.anno_bilancio != null && <Detail icon={FileText} label="Anno Bilancio" value={String(selected.anno_bilancio)} />}
                  </div>

                  {/* Legal */}
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                    {selected.partita_iva && <Detail icon={FileText} label="P.IVA" value={selected.partita_iva} />}
                    {selected.codice_fiscale && <Detail icon={FileText} label="Cod. Fiscale" value={selected.codice_fiscale} />}
                    {selected.forma_giuridica && <Detail icon={Building2} label="Forma Giuridica" value={selected.forma_giuridica} />}
                    {selected.codice_ateco && <Detail icon={FileText} label="ATECO" value={`${selected.codice_ateco}${selected.descrizione_ateco ? ` — ${selected.descrizione_ateco}` : ""}`} />}
                  </div>

                  {selected.rating_affidabilita && (
                    <div className="border-t pt-3">
                      <Badge variant="outline">{selected.rating_affidabilita}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Seleziona un prospect per vedere i dettagli</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
