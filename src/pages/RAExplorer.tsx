import { useState, useMemo } from "react";
import { Search, MapPin, Building2, Users, TrendingUp, Mail, Phone, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Mock ATECO categories
const ATECO_CATEGORIES = [
  { code: "C", label: "Manifatturiere", count: 342 },
  { code: "G", label: "Commercio", count: 1205 },
  { code: "H", label: "Trasporto", count: 487 },
  { code: "J", label: "Informazione", count: 256 },
  { code: "M", label: "Professionali", count: 623 },
];

// Detailed ATECO codes for divisions
const ATECO_DIVISIONS: Record<string, { code: string; label: string; count: number }[]> = {
  C: [
    { code: "C10", label: "Industrie alimentari", count: 45 },
    { code: "C13", label: "Industrie tessili", count: 28 },
    { code: "C25", label: "Fabbricazione di metalli", count: 62 },
    { code: "C26", label: "Fabbricazione di computer", count: 35 },
    { code: "C28", label: "Macchinari specializzati", count: 89 },
  ],
  G: [
    { code: "G46", label: "Commercio all'ingrosso", count: 312 },
    { code: "G47", label: "Commercio al dettaglio", count: 893 },
  ],
  H: [
    { code: "H49", label: "Trasporto terrestre", count: 287 },
    { code: "H50", label: "Trasporto marittimo", count: 89 },
    { code: "H51", label: "Trasporto aereo", count: 45 },
    { code: "H52", label: "Magazzinaggio", count: 66 },
  ],
  J: [
    { code: "J58", label: "Edizione", count: 56 },
    { code: "J61", label: "Telecomunicazioni", count: 78 },
    { code: "J62", label: "Programmazione IT", count: 89 },
    { code: "J63", label: "Servizi informatici", count: 33 },
  ],
  M: [
    { code: "M70", label: "Attività legali", count: 156 },
    { code: "M71", label: "Studi di architettura", count: 98 },
    { code: "M72", label: "Ricerca scientifica", count: 67 },
    { code: "M73", label: "Pubblicità e ricerche", count: 102 },
    { code: "M74", label: "Altre professioni", count: 200 },
  ],
};

// Mock company data
const MOCK_COMPANIES = [
  {
    id: 1,
    name: "Logistica Italia SpA",
    city: "Milano",
    province: "MI",
    piva: "01234567890",
    ateco: "H49.41",
    fatturato: 2500000,
    utile: 150000,
    dipendenti: 45,
    dirigenti: [
      { name: "Marco Rossi", role: "Amministratore Delegato" },
      { name: "Anna Bianchi", role: "Direttore Operativo" },
    ],
  },
  {
    id: 2,
    name: "Trasporti Express SRL",
    city: "Roma",
    province: "RM",
    piva: "02345678901",
    ateco: "H49.41",
    fatturato: 1800000,
    utile: 95000,
    dipendenti: 32,
    dirigenti: [
      { name: "Giovanni Ferrari", role: "Amministratore" },
    ],
  },
  {
    id: 3,
    name: "European Cargo Ltd",
    city: "Torino",
    province: "TO",
    piva: "03456789012",
    ateco: "H49.41",
    fatturato: 3200000,
    utile: 220000,
    dipendenti: 58,
    dirigenti: [
      { name: "Paolo Verdi", role: "Presidente" },
      { name: "Laura Gialli", role: "Direttore Generale" },
    ],
  },
  {
    id: 4,
    name: "Trasporto Nord Italia",
    city: "Padova",
    province: "PD",
    piva: "04567890123",
    ateco: "H49.41",
    fatturato: 1500000,
    utile: 75000,
    dipendenti: 28,
    dirigenti: [
      { name: "Filippo Rossi", role: "Amministratore" },
    ],
  },
  {
    id: 5,
    name: "Logistica Meridionale",
    city: "Napoli",
    province: "NA",
    piva: "05678901234",
    ateco: "H49.41",
    fatturato: 1200000,
    utile: 50000,
    dipendenti: 22,
    dirigenti: [
      { name: "Salvatore Marino", role: "Amministratore Delegato" },
    ],
  },
];

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

export default function RAExplorer() {
  const [selectedAteco, setSelectedAteco] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Expanded divisions for selected section
  const expandedDivisions = selectedAteco ? ATECO_DIVISIONS[selectedAteco.charAt(0)] : [];

  // Filter companies
  const filteredCompanies = useMemo(() => {
    let result = MOCK_COMPANIES;

    if (selectedAteco) {
      result = result.filter(c => c.ateco.startsWith(selectedAteco));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.piva.includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }

    return result;
  }, [selectedAteco, searchQuery]);

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* LEFT COLUMN: ATECO Navigator (250px) */}
      <div className="w-[250px] flex flex-col border-r border-border bg-muted/30">
        <div className="flex-shrink-0 p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Categoria ATECO</h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {ATECO_CATEGORIES.map(cat => (
              <button
                key={cat.code}
                onClick={() => setSelectedAteco(selectedAteco === cat.code ? null : cat.code)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedAteco === cat.code
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-background hover:bg-muted text-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>
                    <strong>{cat.code}</strong> {cat.label}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {cat.count}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Divisions */}
        {expandedDivisions.length > 0 && (
          <div className="flex-shrink-0 border-t border-border p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Divisioni
            </h3>
            <div className="space-y-1">
              {expandedDivisions.map(div => (
                <div
                  key={div.code}
                  className="px-2 py-1.5 text-xs bg-background rounded hover:bg-muted cursor-pointer transition-colors"
                  title={div.label}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-primary">{div.code}</span>
                    <span className="text-muted-foreground">{div.count}</span>
                  </div>
                  <div className="text-muted-foreground truncate">{div.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CENTER COLUMN: Prospect List (flex) */}
      <div className="flex-1 flex flex-col border-r border-border">
        <div className="flex-shrink-0 p-4 border-b border-border space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">
              Prospect {selectedAteco ? `(${selectedAteco})` : ""}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome, P.IVA, città..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {filteredCompanies.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center text-muted-foreground">
                <div>
                  <p className="text-sm font-medium">Nessuna azienda trovata</p>
                  <p className="text-xs mt-1">Seleziona un'ATECO o modifica la ricerca</p>
                </div>
              </div>
            ) : (
              filteredCompanies.map(company => (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedCompany?.id === company.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="font-medium text-foreground text-sm line-clamp-1">
                      {company.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{company.city}, {company.province}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Briefcase className="w-3 h-3" />
                      <span className="font-mono">{company.piva}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Fatturato: {formatCurrency(company.fatturato)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {company.dipendenti} dipendenti
                      </Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT COLUMN: Company Detail (350px) */}
      <div className="w-[350px] flex flex-col bg-card border-l border-border overflow-hidden">
        {selectedCompany ? (
          <>
            <div className="flex-shrink-0 p-4 border-b border-border space-y-3">
              <div>
                <h2 className="text-base font-semibold text-foreground line-clamp-2">
                  {selectedCompany.name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedCompany.ateco}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {selectedCompany.city}
                  </Badge>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-5">
                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground font-medium">Fatturato</div>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {formatCurrency(selectedCompany.fatturato)}
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground font-medium">Utile</div>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {formatCurrency(selectedCompany.utile)}
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground font-medium">Dipendenti</div>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {selectedCompany.dipendenti}
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground font-medium">Margine</div>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {((selectedCompany.utile / selectedCompany.fatturato) * 100).toFixed(1)}%
                    </div>
                  </Card>
                </div>

                {/* Company Info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Informazioni
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">P.IVA</p>
                      <p className="text-sm font-mono text-foreground mt-0.5">
                        {selectedCompany.piva}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Città</p>
                      <p className="text-sm text-foreground mt-0.5">
                        {selectedCompany.city}, {selectedCompany.province}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">ATECO</p>
                      <p className="text-sm font-mono text-foreground mt-0.5">
                        {selectedCompany.ateco}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dirigenti */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Dirigenti
                  </h3>
                  <div className="space-y-2">
                    {selectedCompany.dirigenti.map((person: any, idx: number) => (
                      <Card key={idx} className="p-3">
                        <p className="text-sm font-medium text-foreground">{person.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{person.role}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex-shrink-0 p-4 border-t border-border space-y-2">
              <Button className="w-full" size="sm">
                <Briefcase className="w-4 h-4 mr-2" />
                Deep Search
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                <Building2 className="w-4 h-4 mr-2" />
                Aggiungi a CRM
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <div>
              <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Seleziona un'azienda
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                per visualizzare i dettagli
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
