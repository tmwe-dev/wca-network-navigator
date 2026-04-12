import { useState, useMemo } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import {
  Search,
  MapPin,
  Building2,
  Users,
  TrendingUp,
  Mail,
  Phone,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

// Group ATECO codes by first letter
function groupAtecoBySection(categories: Array<{ codice: string; descrizione: string }>) {
  const sections: Record<string, Array<{ codice: string; descrizione: string }>> = {};
  for (const cat of categories) {
    if (cat.codice.length === 1) {
      // Section level (A, B, C, etc.)
      const letter = cat.codice;
      if (!sections[letter]) {
        sections[letter] = [];
      }
    } else if (cat.codice.length === 2 && cat.codice[0].toUpperCase() === cat.codice[0]) {
      // Division level (10, 20, etc.)
      const section = cat.codice[0].toUpperCase();
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(cat);
    }
  }
  return sections;
}

export default function RAExplorer() {
  const navigate = useAppNavigate();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedAtecoCodes, setSelectedAtecoCodes] = useState<string[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<RAProspect | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Group ATECO by section
  const atecoBySection = useMemo(() => {
    const sections: Record<string, Array<{ codice: string; descrizione: string }>> = {};
    const sectionInfo: Record<string, string> = {};

    for (const cat of ATECO_TREE) {
      const firstLetter = cat.codice[0].toUpperCase();

      // Store section-level info
      if (cat.codice.length === 1) {
        sectionInfo[firstLetter] = cat.descrizione;
      }

      // Group by section
      if (!sections[firstLetter]) {
        sections[firstLetter] = [];
      }
      sections[firstLetter].push({ codice: cat.codice, descrizione: cat.descrizione });
    }

    return { sections, sectionInfo };
  }, []);

  // Get ATECO sections A-U
  const sections = useMemo(() => {
    return Object.keys(atecoBySection.sections)
      .filter(s => s >= "A" && s <= "U")
      .sort();
  }, [atecoBySection]);

  // Get codes for expanded section
  const expandedCodes = useMemo(() => {
    if (!expandedSection) return [];
    return atecoBySection.sections[expandedSection]?.filter(c => c.codice.length <= 3) || [];
  }, [expandedSection, atecoBySection]);

  // Fetch prospects with selected filters
  const { data: prospectsData, isLoading: prospectsLoading } = useRAProspects({
    atecoCodes: selectedAtecoCodes.length > 0 ? selectedAtecoCodes : undefined,
    search: searchQuery.trim() || undefined,
    pageSize: 100,
  });

  // Fetch contacts for selected prospect
  const { data: contacts = [], isLoading: contactsLoading } = useRAProspectContacts(
    selectedProspect?.id
  );

  const handleToggleAteco = (code: string) => {
    setSelectedAtecoCodes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  return (
    <div className="h-full flex overflow-hidden" style={{
      background: "linear-gradient(135deg, #0f0c1a 0%, #1a1530 100%)"
    }}>
      {/* LEFT COLUMN: ATECO Navigator */}
      <div
        className="w-[280px] flex flex-col backdrop-blur-lg border-r overflow-hidden"
        style={{
          backgroundColor: "rgba(20, 15, 35, 0.4)",
          borderColor: "rgba(0, 255, 200, 0.1)"
        }}
      >
        <div
          className="flex-shrink-0 p-4 border-b"
          style={{ borderColor: "rgba(0, 255, 200, 0.1)" }}
        >
          <h2 className="text-sm font-semibold text-cyan-300">
            Sezioni ATECO
          </h2>
          <p className="text-xs text-cyan-200/60 mt-1">
            {selectedAtecoCodes.length} selezionati
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {sections.map(section => (
              <div key={section}>
                <button
                  onClick={() => {
                    setExpandedSection(expandedSection === section ? null : section);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    backgroundColor: expandedSection === section ? "rgba(0, 255, 200, 0.15)" : "transparent",
                    color: expandedSection === section ? "#00ffc8" : "#a0a0c8",
                    borderColor: expandedSection === section ? "rgba(0, 255, 200, 0.2)" : "transparent",
                    borderWidth: "1px"
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {expandedSection === section ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <strong>{section}</strong>
                      <span className="text-xs opacity-70">
                        {atecoBySection.sectionInfo[section]}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded divisions */}
                {expandedSection === section && expandedCodes.length > 0 && (
                  <div className="ml-3 mt-1 space-y-1 border-l" style={{ borderColor: "rgba(0, 255, 200, 0.1)" }}>
                    {expandedCodes.map(code => (
                      <button
                        key={code.codice}
                        onClick={() => handleToggleAteco(code.codice)}
                        className="w-full text-left px-3 py-1.5 text-xs rounded transition-all block"
                        style={{
                          backgroundColor: selectedAtecoCodes.includes(code.codice)
                            ? "rgba(168, 85, 247, 0.2)"
                            : "transparent",
                          color: selectedAtecoCodes.includes(code.codice)
                            ? "#d8b4fe"
                            : "#7080a0",
                          borderColor: selectedAtecoCodes.includes(code.codice)
                            ? "rgba(168, 85, 247, 0.2)"
                            : "transparent",
                          borderWidth: "1px"
                        }}
                        title={code.descrizione}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono font-semibold"
                            style={{ fontFamily: "JetBrains Mono" }}
                          >
                            {code.codice}
                          </span>
                          <span className="truncate opacity-70">
                            {code.descrizione}
                          </span>
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
      <div
        className="flex-1 flex flex-col border-r backdrop-blur-lg"
        style={{
          backgroundColor: "rgba(20, 15, 35, 0.3)",
          borderColor: "rgba(0, 255, 200, 0.1)"
        }}
      >
        <div
          className="flex-shrink-0 p-4 border-b space-y-3"
          style={{ borderColor: "rgba(0, 255, 200, 0.1)" }}
        >
          <div>
            <h2 className="text-sm font-semibold text-cyan-300 mb-2">
              Prospect
              {prospectsLoading && (
                <Loader2 className="w-4 h-4 inline ml-2 animate-spin" />
              )}
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
              <Input
                placeholder="Cerca nome, P.IVA, città..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-black/30 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-400/30"
                style={{
                  backgroundColor: "rgba(0, 20, 40, 0.5)",
                  borderColor: "rgba(0, 255, 200, 0.2)"
                }}
              />
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {prospectsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            ) : !prospectsData?.items || prospectsData.items.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center">
                <div>
                  <Building2 className="w-8 h-8 text-cyan-400/30 mx-auto mb-2" />
                  <p className="text-sm text-cyan-300/70">Nessuna azienda trovata</p>
                  <p className="text-xs text-cyan-200/50 mt-1">
                    Seleziona un'ATECO o modifica la ricerca
                  </p>
                </div>
              </div>
            ) : (
              prospectsData.items.map(prospect => (
                <button
                  key={prospect.id}
                  onClick={() => setSelectedProspect(prospect)}
                  className="w-full text-left p-3 rounded-lg border transition-all"
                  style={{
                    backgroundColor: selectedProspect?.id === prospect.id
                      ? "rgba(0, 255, 200, 0.15)"
                      : "rgba(0, 255, 200, 0.05)",
                    borderColor: selectedProspect?.id === prospect.id
                      ? "rgba(0, 255, 200, 0.4)"
                      : "rgba(0, 255, 200, 0.1)",
                  }}
                >
                  <div className="space-y-1.5">
                    <div className="font-medium text-cyan-100 text-sm line-clamp-1">
                      {prospect.company_name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cyan-300/70">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {prospect.city}{prospect.province ? `, ${prospect.province}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cyan-300/70">
                      <Briefcase className="w-3 h-3" />
                      <span className="font-mono" style={{ fontFamily: "JetBrains Mono" }}>
                        {prospect.partita_iva || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-cyan-300/60">
                        Fatturato: {formatCurrency(prospect.fatturato)}
                      </span>
                      {prospect.dipendenti && (
                        <Badge
                          className="text-xs"
                          style={{
                            backgroundColor: "rgba(168, 85, 247, 0.2)",
                            color: "#d8b4fe",
                            border: "1px solid rgba(168, 85, 247, 0.3)"
                          }}
                        >
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
      <div
        className="w-[380px] flex flex-col border-l backdrop-blur-lg overflow-hidden"
        style={{
          backgroundColor: "rgba(20, 15, 35, 0.4)",
          borderColor: "rgba(0, 255, 200, 0.1)"
        }}
      >
        {selectedProspect ? (
          <>
            <div
              className="flex-shrink-0 p-4 border-b space-y-3"
              style={{ borderColor: "rgba(0, 255, 200, 0.1)" }}
            >
              <div>
                <h2 className="text-base font-semibold text-cyan-300 line-clamp-2">
                  {selectedProspect.company_name}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: "rgba(0, 255, 200, 0.15)",
                      color: "#00ffc8",
                      border: "1px solid rgba(0, 255, 200, 0.2)"
                    }}
                  >
                    {selectedProspect.codice_ateco || "—"}
                  </Badge>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: "rgba(168, 85, 247, 0.15)",
                      color: "#d8b4fe",
                      border: "1px solid rgba(168, 85, 247, 0.2)"
                    }}
                  >
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
                      value:
                        selectedProspect.fatturato && selectedProspect.utile
                          ? `${((selectedProspect.utile / selectedProspect.fatturato) * 100).toFixed(1)}%`
                          : "—"
                    },
                  ].map(kpi => (
                    <div
                      key={kpi.label}
                      className="p-3 rounded-lg backdrop-blur border"
                      style={{
                        backgroundColor: "rgba(0, 255, 200, 0.08)",
                        borderColor: "rgba(0, 255, 200, 0.15)"
                      }}
                    >
                      <div className="text-xs text-cyan-300/70 font-medium">
                        {kpi.label}
                      </div>
                      <div className="text-lg font-bold text-cyan-200 mt-1 font-mono" style={{
                        fontFamily: "JetBrains Mono"
                      }}>
                        {kpi.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Company Info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">
                    Informazioni
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: "P.IVA", value: selectedProspect.partita_iva || "—" },
                      {
                        label: "Indirizzo",
                        value: [selectedProspect.address, selectedProspect.cap, selectedProspect.city]
                          .filter(Boolean)
                          .join(" ") || "—"
                      },
                      { label: "Provincia", value: selectedProspect.province || "—" },
                      { label: "ATECO", value: selectedProspect.codice_ateco || "—" },
                      { label: "Email", value: selectedProspect.email || "—" },
                      { label: "PEC", value: selectedProspect.pec || "—" },
                      { label: "Telefono", value: selectedProspect.phone || "—" },
                      { label: "Website", value: selectedProspect.website || "—" },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-xs text-cyan-300/70 font-medium">
                          {item.label}
                        </p>
                        <p
                          className="text-sm text-cyan-100 mt-0.5 break-all font-mono"
                          style={{ fontFamily: item.label.includes("IVA") || item.label === "ATECO" ? "JetBrains Mono" : "inherit" }}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contacts */}
                {contactsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                ) : contacts && contacts.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">
                      Contatti ({contacts.length})
                    </h3>
                    <div className="space-y-2">
                      {(contacts as RAContact[]).map(contact => (
                        <div
                          key={contact.id}
                          className="p-3 rounded-lg backdrop-blur border"
                          style={{
                            backgroundColor: "rgba(168, 85, 247, 0.08)",
                            borderColor: "rgba(168, 85, 247, 0.15)"
                          }}
                        >
                          <p className="text-sm font-medium text-purple-200">
                            {contact.name}
                          </p>
                          <p className="text-xs text-purple-300/70 mt-0.5">
                            {contact.role || "Posizione non specificata"}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-purple-200/60 mt-1 break-all font-mono" style={{
                              fontFamily: "JetBrains Mono"
                            }}>
                              {contact.email}
                            </p>
                          )}
                          {contact.phone && (
                            <p className="text-xs text-purple-200/60 font-mono" style={{
                              fontFamily: "JetBrains Mono"
                            }}>
                              {contact.phone}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div
              className="flex-shrink-0 p-4 border-t space-y-2"
              style={{ borderColor: "rgba(0, 255, 200, 0.1)" }}
            >
              <Button
                onClick={() => navigate(`/ra/company/${selectedProspect.id}`)}
                className="w-full text-sm"
                style={{
                  backgroundColor: "rgba(0, 255, 200, 0.2)",
                  color: "#00ffc8",
                  border: "1px solid rgba(0, 255, 200, 0.3)",
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Vedi Dettaglio
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <div>
              <Building2 className="w-12 h-12 text-cyan-400/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-cyan-300/70">
                Seleziona un'azienda
              </p>
              <p className="text-xs text-cyan-200/50 mt-1">
                per visualizzare i dettagli
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
