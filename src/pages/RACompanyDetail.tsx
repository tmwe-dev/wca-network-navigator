import { useState } from "react";
import { ArrowLeft, Mail, Phone, Briefcase, TrendingUp, Users, DollarSign, Star, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Mock company data
const MOCK_COMPANY = {
  id: 1,
  name: "European Cargo Ltd",
  city: "Torino",
  province: "TO",
  region: "Piemonte",
  address: "Via dell'Industria 45",
  piva: "03456789012",
  cf: "ABCDEF12G34H567I",
  ateco: "H49.41",
  atecoLabel: "Trasporto su strada di merci",
  fatturato: 3200000,
  utile: 220000,
  dipendenti: 58,
  rating: 4.5,
  fondazione: 2008,
  website: "www.eurocargo.it",
  email: "info@eurocargo.it",
  telefono: "+39 011 234567",
  dirigenti: [
    { id: 1, name: "Paolo Verdi", role: "Presidente", email: "p.verdi@eurocargo.it" },
    { id: 2, name: "Laura Gialli", role: "Direttore Generale", email: "l.gialli@eurocargo.it" },
    { id: 3, name: "Marco Blu", role: "Direttore Operativo", email: "m.blu@eurocargo.it" },
  ],
  interazioni: [
    { data: "2024-03-15", tipo: "email", descrizione: "Invio proposta commerciale" },
    { data: "2024-03-10", tipo: "call", descrizione: "Primo contatto telefonico" },
    { data: "2024-03-05", tipo: "note", descrizione: "Interesse confermato per partnership logistica" },
  ],
};

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function getRatingStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return Array(full)
    .fill("full")
    .concat(Array(half).fill("half"))
    .concat(Array(empty).fill("empty"));
}

export default function RACompanyDetail() {
  const [selectedDirective, setSelectedDirective] = useState<number | null>(null);
  const company = MOCK_COMPANY;

  const stars = getRatingStars(company.rating);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border bg-card">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{company.city}, {company.province}</Badge>
              <Badge variant="secondary">{company.ateco}</Badge>
              <Badge className="gap-1">
                <Star className="w-3 h-3 fill-current" />
                {company.rating}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" />
              Esporta
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-muted/30">
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground">Fatturato</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(company.fatturato)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Margine: {((company.utile / company.fatturato) * 100).toFixed(1)}%
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs font-semibold text-muted-foreground">Utile</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(company.utile)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Anno fiscale 2023
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-muted-foreground">Dipendenti</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {company.dipendenti}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Azienda media
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-semibold text-muted-foreground">Rating</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {company.rating}
            </div>
            <div className="flex gap-1 mt-1">
              {stars.slice(0, 5).map((s, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    s === "full" ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Company Info */}
        <div className="flex-1 border-r border-border overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Anagrafe */}
              <section>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                  Informazioni Anagrafiche
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">P.IVA</label>
                    <p className="text-sm font-mono text-foreground mt-1.5">
                      {company.piva}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Codice Fiscale</label>
                    <p className="text-sm font-mono text-foreground mt-1.5">
                      {company.cf}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Indirizzo</label>
                    <p className="text-sm text-foreground mt-1.5">
                      {company.address}, {company.city} ({company.province})
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Regione</label>
                    <p className="text-sm text-foreground mt-1.5">
                      {company.region}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fondazione</label>
                    <p className="text-sm text-foreground mt-1.5">
                      {company.fondazione}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Età Azienda</label>
                    <p className="text-sm text-foreground mt-1.5">
                      {new Date().getFullYear() - company.fondazione} anni
                    </p>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Settore ATECO */}
              <section>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                  Settore Economico
                </h2>
                <Card className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Codice ATECO</label>
                      <p className="text-lg font-mono font-bold text-foreground mt-1.5">
                        {company.ateco}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Descrizione</label>
                      <p className="text-sm text-foreground mt-1.5">
                        {company.atecoLabel}
                      </p>
                    </div>
                  </div>
                </Card>
              </section>

              <Separator />

              {/* Contatti */}
              <section>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                  Contatti
                </h2>
                <div className="space-y-3">
                  {company.website && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Website</p>
                        <p className="text-sm text-foreground truncate">{company.website}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {company.email && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Email</p>
                        <p className="text-sm text-foreground truncate">{company.email}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {company.telefono && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Telefono</p>
                        <p className="text-sm text-foreground truncate">{company.telefono}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              {/* Dati Finanziari */}
              <section>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                  Dati Finanziari
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Fatturato Medio Annuo</p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {formatCurrency(company.fatturato)}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Utile Netto</p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {formatCurrency(company.utile)}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Margine Netto</p>
                    <p className="text-lg font-bold text-foreground mt-2">
                      {((company.utile / company.fatturato) * 100).toFixed(1)}%
                    </p>
                  </Card>
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Contacts & Actions */}
        <div className="w-96 border-l border-border flex flex-col bg-muted/20">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Dirigenti */}
              <section>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                  Dirigenti ({company.dirigenti.length})
                </h2>
                <div className="space-y-3">
                  {company.dirigenti.map(dirigente => (
                    <div
                      key={dirigente.id}
                      onClick={() => setSelectedDirective(selectedDirective === dirigente.id ? null : dirigente.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedDirective === dirigente.id
                          ? "bg-primary/5 border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      <h3 className="font-medium text-foreground text-sm">
                        {dirigente.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dirigente.role}
                      </p>
                      {selectedDirective === dirigente.id && (
                        <>
                          <Separator className="my-3" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="text-xs text-foreground font-mono">
                                {dirigente.email}
                              </p>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                                Scrivi Email
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              {/* Timeline Interazioni */}
              {company.interazioni.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                    Timeline Interazioni
                  </h2>
                  <div className="space-y-3">
                    {company.interazioni.map((int, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute left-2 top-0 w-0.5 h-full bg-muted" />
                        <Card className="p-3 ml-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                {new Date(int.data).toLocaleDateString("it-IT")}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {int.descrizione}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs capitalize">
                              {int.tipo}
                            </Badge>
                          </div>
                        </Card>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>

          {/* Action Buttons */}
          <div className="flex-shrink-0 p-4 border-t border-border space-y-2">
            <Button className="w-full" size="sm">
              <Briefcase className="w-4 h-4 mr-2" />
              Deep Search
            </Button>
            <Button variant="outline" className="w-full" size="sm">
              <Building2Icon className="w-4 h-4 mr-2" />
              Aggiungi a CRM
            </Button>
            <Button variant="outline" className="w-full" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Scrivi Email
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for building icon
function Building2Icon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 21h18M3 10h18M3 6h18" />
      <rect x="3" y="10" width="3" height="11" />
      <rect x="9" y="6" width="3" height="15" />
      <rect x="15" y="3" width="3" height="18" />
    </svg>
  );
}
