/**
 * ResultsList — Renders partner / contact / BCA results
 */
import { useRef } from "react";
import { ChevronRight, Mail, Check, MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import type { UseEmailContactPickerReturn } from "@/hooks/useEmailContactPicker";

interface ResultsListProps {
  readonly picker: UseEmailContactPickerReturn;
}

export function ResultsList({ picker }: ResultsListProps) {
  const {
    state, dispatch,
    shouldSearch,
    filteredPartners, partnerContacts,
    filteredContacts, groupedContacts,
    filteredBca,
    isSelected,
    handleSelectPartner, handleSelectContact, handleSelectImported, handleSelectBca,
  } = picker;
  const contactsListRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 relative" ref={contactsListRef}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="rounded-lg bg-muted/15 border border-border/20 p-1.5 min-h-[120px]">
          {!shouldSearch && state.tab === "partners" && filteredPartners.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4">
              Seleziona un paese o digita almeno 3 caratteri
            </p>
          )}

          {/* ═══ Partners ═══ */}
          {state.tab === "partners" && (filteredPartners.length > 0 || shouldSearch) && (
            <div className="space-y-1.5">
              {filteredPartners.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Nessun risultato</p>}
              {filteredPartners.map(p => (
                <div key={p.id} className="relative">
                  <div className={cn(
                    "rounded-lg border bg-card shadow-sm",
                    state.expandedPartner === p.id ? "border-primary/30" : "border-border/50"
                  )}>
                    <button
                      onClick={() => dispatch({ type: "SET_EXPANDED_PARTNER", id: state.expandedPartner === p.id ? null : p.id })}
                      className={cn(
                        "w-full flex items-start gap-2 px-3 py-2 text-xs transition-all hover:bg-muted/40 rounded-lg",
                        state.expandedPartner === p.id && "bg-muted/20"
                      )}
                    >
                      <ChevronRight className={cn("w-3 h-3 transition-transform flex-shrink-0 text-muted-foreground mt-0.5", state.expandedPartner === p.id && "rotate-90")} />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-semibold text-foreground truncate text-[11px]">{p.company_name}</div>
                        {p.city && (
                          <div className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" /> {p.city}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {p.country_code && (
                          <span className="text-base leading-none" title={WCA_COUNTRIES_MAP[p.country_code]?.name || p.country_code}>
                            {getCountryFlag(p.country_code)}
                          </span>
                        )}
                        {!isSelected(p.id) ? (
                          <button
                            onClick={e => { e.stopPropagation(); handleSelectPartner(p); }}
                            className="text-[9px] text-primary font-medium hover:underline"
                          >+Azienda</button>
                        ) : (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                    </button>
                  </div>
                  {state.expandedPartner === p.id && (
                    <div className="absolute left-0 right-0 z-20 mt-0.5 rounded-lg border border-primary/30 bg-popover/98 backdrop-blur-sm shadow-lg p-2 space-y-0.5 max-h-[200px] overflow-y-auto">
                      {partnerContacts.length === 0 && (
                        <p className="text-[9px] text-muted-foreground py-1 px-1">Nessun contatto</p>
                      )}
                      {partnerContacts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectContact(p.id, p.company_name || "", p.company_alias || undefined, p.country_code || undefined, c)}
                          disabled={isSelected(p.id, c.id)}
                          className={cn(
                            "w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-all",
                            isSelected(p.id, c.id) ? "opacity-50 bg-muted/20" : "hover:bg-primary/10"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-medium text-foreground truncate">{c.name}</div>
                            {c.title && <div className="text-[9px] text-muted-foreground truncate">{c.title}</div>}
                          </div>
                          {c.email && <Mail className="w-3 h-3 text-primary/60 flex-shrink-0 mt-0.5" />}
                          {isSelected(p.id, c.id)
                            ? <Check className="w-3 h-3 text-primary mt-0.5" />
                            : <span className="text-primary text-[9px] font-medium mt-0.5">+</span>
                          }
                        </button>
                      ))}
                      <button
                        onClick={() => dispatch({ type: "SET_EXPANDED_PARTNER", id: null })}
                        className="w-full text-center text-[9px] text-muted-foreground hover:text-foreground py-1 mt-0.5 border-t border-border/30"
                      >
                        Chiudi ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══ Contacts ═══ */}
          {state.tab === "contacts" && (
            <div className="space-y-1.5">
              {filteredContacts.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Nessun risultato</p>}
              {groupedContacts.map(([companyName, members]) => (
                <div key={companyName} className="relative">
                  <div className={cn(
                    "rounded-lg border bg-card shadow-sm",
                    state.expandedCompany === companyName ? "border-primary/30" : "border-border/50"
                  )}>
                    {members.length === 1 ? (
                      <button
                        onClick={() => handleSelectImported(members[0])}
                        disabled={isSelected(members[0].id)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-all rounded-lg",
                          isSelected(members[0].id) ? "opacity-50" : "hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate text-[11px]">{companyName !== "Senza azienda" ? companyName : (members[0].name || "—")}</div>
                            {members[0].name && companyName !== "Senza azienda" && (
                              <div className="text-[10px] text-foreground/80 truncate">{members[0].name}</div>
                            )}
                            {members[0].position && (
                              <div className="text-[9px] text-muted-foreground truncate">{members[0].position}</div>
                            )}
                            {members[0].country && (
                              <div className="text-[8px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                <MapPin className="w-2 h-2" /> {members[0].country}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 shrink-0">
                            {members[0].origin && <Badge variant="outline" className="text-[7px] h-3 px-1 border-border/40">{members[0].origin}</Badge>}
                            {members[0].email && <Mail className="w-3 h-3 text-primary/60" />}
                            {isSelected(members[0].id) ? <Check className="w-3 h-3 text-primary" /> : <span className="text-primary text-[9px]">+</span>}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch({ type: "SET_EXPANDED_COMPANY", name: state.expandedCompany === companyName ? null : companyName })}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-xs transition-all hover:bg-muted/40 rounded-lg",
                          state.expandedCompany === companyName && "bg-muted/20"
                        )}
                      >
                        <ChevronRight className={cn("w-3 h-3 transition-transform flex-shrink-0 text-muted-foreground", state.expandedCompany === companyName && "rotate-90")} />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-semibold text-foreground truncate text-[11px]">{companyName}</div>
                        </div>
                        <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{members.length}</Badge>
                      </button>
                    )}
                  </div>
                  {members.length > 1 && state.expandedCompany === companyName && (
                    <div className="absolute left-0 right-0 z-20 mt-0.5 rounded-lg border border-primary/30 bg-popover/98 backdrop-blur-sm shadow-lg p-2 space-y-0.5 max-h-[200px] overflow-y-auto">
                      {members.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectImported(c)}
                          disabled={isSelected(c.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-md transition-all",
                            isSelected(c.id) ? "opacity-50 bg-muted/20" : "hover:bg-primary/10"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-medium text-foreground truncate">{c.name || "—"}</div>
                              {c.position && <div className="text-[9px] text-muted-foreground truncate">{c.position}</div>}
                            </div>
                            {c.email && <Mail className="w-3 h-3 text-primary/60 mt-0.5" />}
                            {isSelected(c.id) ? <Check className="w-3 h-3 text-primary mt-0.5" /> : <span className="text-primary text-[9px] mt-0.5">+</span>}
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => dispatch({ type: "SET_EXPANDED_COMPANY", name: null })}
                        className="w-full text-center text-[9px] text-muted-foreground hover:text-foreground py-1 mt-0.5 border-t border-border/30"
                      >
                        Chiudi ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══ BCA ═══ */}
          {state.tab === "bca" && (
            <div className="space-y-1.5">
              {filteredBca.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Nessun risultato</p>}
              {filteredBca.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectBca(c)}
                  disabled={isSelected(c.matched_partner_id || c.id)}
                  className={cn(
                    "w-full text-left rounded-lg border border-border/50 bg-card px-3 py-2 text-xs transition-all shadow-sm",
                    isSelected(c.matched_partner_id || c.id) ? "opacity-50" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate text-[11px]">{c.company_name || c.contact_name || "—"}</div>
                      {c.contact_name && c.company_name && (
                        <div className="text-[10px] text-foreground/80 truncate">{c.contact_name}</div>
                      )}
                      {c.location && (
                        <div className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {c.location}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 shrink-0">
                      {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                      {isSelected(c.matched_partner_id || c.id) ? <Check className="w-3 h-3 text-primary" /> : <span className="text-primary text-[9px]">+</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
