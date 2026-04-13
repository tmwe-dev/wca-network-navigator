import { useState, useMemo } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Search, MapPin, Building2, Briefcase, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRAProspects, useRAProspectContacts } from "@/hooks/useRAProspects";
import { ATECO_TREE } from "@/data/atecoCategories";
import type { RAProspect, RAContact } from "@/types/ra";

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

export default function RAExplorer() {
  const navigate = useAppNavigate();
  const [_selectedSection, _setSelectedSection] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedAtecoCodes, setSelectedAtecoCodes] = useState<string[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<RAProspect | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const atecoBySection = useMemo(() => {
    const sections: Record<string, Array<{ codice: string; descrizione: string }>> = {};
    const sectionInfo: Record<string, string> = {};
    for (const cat of ATECO_TREE) {
      const firstLetter = cat.codice[0].toUpperCase();
      if (cat.codice.length === 1) sectionInfo[firstLetter] = cat.descrizione;
      if (!sections[firstLetter]) sections[firstLetter] = [];
      sections[firstLetter].push({ codice: cat.codice, descrizione: cat.descrizione });
    }
    return { sections, sectionInfo };
  }, []);

  const sections = useMemo(() => {
    return Object.keys(atecoBySection.sections).filter(s => s >= "A" && s <= "U").sort();
  }, [atecoBySection]);

  const expandedCodes = useMemo(() => {
    if (!expandedSection) return [];
    return atecoBySection.sections[expandedSection]?.filter(c => c.codice.length <= 3) || [];
  }, [expandedSection, atecoBySection]);

  const { data: prospectsData, isLoading: prospectsLoading } = useRAProspects({
    atecoCodes: selectedAtecoCodes.length > 0 ? selectedAtecoCodes : undefined,
    search: searchQuery.trim() || undefined,
    pageSize: 100,
  });

  const { data: contacts = [], isLoading: contactsLoading } = useRAProspectContacts(
    selectedProspect?.id
  );

  const handleToggleAteco = (code: string) => {
    setSelectedAtecoCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* LEFT COLUMN: ATECO Navigator */}
      <div className="w-[280px] flex flex-col border-r border-border/40 bg-card/60 backdrop-blur-lg overflow-hidden">
        <div className="flex-shrink-0 p-4 border-b border-border/40">
          <h2 className="text-sm font-semibold text-primary">Sezioni ATECO</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedAtecoCodes.length} selezionati
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {sections.map(section => (
              <div key={section}>
                <button
                  onClick={() => setExpandedSection(expandedSection === section ? null : section)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                    expandedSection === section
                      ? "bg-primary/15 border-primary/20 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedSection === section ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <strong>{section}</strong>
                      <span className="text-xs opacity-70">{atecoBySection.sectionInfo[section]}</span>
                    </div>
                  </div>
                </button>

                {expandedSection === section && expandedCodes.length > 0 && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-border/40">
                    {expandedCodes.map(code => (
                      <button
                        key={code.codice}
                        onClick={() => handleToggleAteco(code.codice)}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded transition-all block border ${
                          selectedAtecoCodes.includes(code.codice)
                            ? "bg-primary/20 border-primary/20 text-primary"
                            : "border-transparent text-muted-foreground hover:bg-muted/30"
                        }`}
                        title={code.descrizione}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{code.codice}</span>
                          <span className="truncate opacity-70">{code.descrizione}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* CENTER COLUMN: Prospect List */}
      <div className="flex-1 flex flex-col border-r border-border/40 bg-card/40 backdrop-blur-lg">
        <div className="flex-shrink-0 p-4 border-b border-border/40 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-primary mb-2">
              Prospect
              {prospectsLoading && <Loader2 className="w-4 h-4 inline ml-2 animate-spin" />}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca nome, P.IVA, città..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/30 border-border"
              />
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {prospectsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : !prospectsData?.items || prospectsData.items.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center">
                <div>
                  <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nessuna azienda trovata</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Seleziona un'ATECO o modifica la ricerca
                  </p>
                </div>
              </div>
            ) : (
              prospectsData.items.map(prospect => (
                <button
                  key={prospect.id}
                  onClick={() => setSelectedProspect(prospect)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedProspect?.id === prospect.id
                      ? "bg-primary/15 border-primary/40"
                      : "bg-primary/5 border-border/40 hover:border-primary/20"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="font-medium text-foreground text-sm line-clamp-1">
                      {prospect.company_name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{prospect.city}{prospect.province ? `, ${prospect.province}` : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Briefcase className="w-3 h-3" />
                      <span className="font-mono">{prospect.partita_iva || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Fatturato: {formatCurrency(prospect.fatturato)}
                      </span>
                      {prospect.dipendenti && (
                        <Badge variant="secondary" className="text-xs">
                          {prospect.dipendenti} dipendenti
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT COLUMN: Company Detail */}
      <div className="w-[380px] flex flex-col border-l border-border/40 bg-card/60 backdrop-blur-lg overflow-hidden">
        {selectedProspect ? (
          <>
            <div className="flex-shrink-0 p-4 border-b border-border/40 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-primary line-clamp-2">
                  {selectedProspect.company_name}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs border-primary/20 text-primary">
                    {selectedProspect.codice_ateco || "—"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {selectedProspect.city || "—"}
                  </Badge>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-5">
                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Fatturato", value: formatCurrency(selectedProspect.fatturato) },
                    { label: "Utile", value: formatCurrency(selectedProspect.utile) },
                    { label: "Dipendenti", value: selectedProspect.dipendenti?.toString() || "—" },
                    {
                      label: "Margine",
                      value: selectedProspect.fatturato && selectedProspect.utile
                        ? `${((selectedProspect.utile / selectedProspect.fatturato) * 100).toFixed(1)}%`
                        : "—"
                    },
                  ].map(kpi => (
                    <div key={kpi.label} className="p-3 rounded-lg border border-primary/15 bg-primary/5">
                      <div className="text-xs text-muted-foreground font-medium">{kpi.label}</div>
                      <div className="text-lg font-bold text-foreground mt-1 font-mono">{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Company Info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wide">Informazioni</h3>
                  <div className="space-y-2">
                    {[
                      { label: "P.IVA", value: selectedProspect.partita_iva || "—" },
                      { label: "Indirizzo", value: [selectedProspect.address, selectedProspect.cap, selectedProspect.city].filter(Boolean).join(" ") || "—" },
                      { label: "Provincia", value: selectedProspect.province || "—" },
                      { label: "ATECO", value: selectedProspect.codice_ateco || "—" },
                      { label: "Email", value: selectedProspect.email || "—" },
                      { label: "PEC", value: selectedProspect.pec || "—" },
                      { label: "Telefono", value: selectedProspect.phone || "—" },
                      { label: "Website", value: selectedProspect.website || "—" },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                        <p className={`text-sm text-foreground mt-0.5 break-all ${item.label.includes("IVA") || item.label === "ATECO" ? "font-mono" : ""}`}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contacts */}
                {contactsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                ) : contacts && contacts.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-primary uppercase tracking-wide">
                      Contatti ({contacts.length})
                    </h3>
                    <div className="space-y-2">
                      {(contacts as RAContact[]).map(contact => (
                        <div key={contact.id} className="p-3 rounded-lg border border-primary/15 bg-primary/5">
                          <p className="text-sm font-medium text-foreground">{contact.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {contact.role || "Posizione non specificata"}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-muted-foreground mt-1 break-all font-mono">{contact.email}</p>
                          )}
                          {contact.phone && (
                            <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex-shrink-0 p-4 border-t border-border/40 space-y-2">
              <Button
                onClick={() => navigate(`/ra/company/${selectedProspect.id}`)}
                className="w-full text-sm"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Vedi Dettaglio
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <div>
              <Building2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Seleziona un'azienda</p>
              <p className="text-xs text-muted-foreground/60 mt-1">per visualizzare i dettagli</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
