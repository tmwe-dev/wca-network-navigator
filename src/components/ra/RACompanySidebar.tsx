import { useState } from "react";
import { Mail, Phone, Briefcase, ChevronDown, Copy, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RALeadStatus, RAContact, RAInteraction } from "@/types/ra";
import { LEAD_STATUS_LABELS } from "./RACompanyHeader";
import { createLogger } from "@/lib/log";

const log = createLogger("RACompanySidebar");

const LEAD_STATUS_OPTIONS: RALeadStatus[] = ["new", "contacted", "qualified", "negotiation", "converted", "lost"];

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return "—"; }
}

interface RACompanySidebarProps {
  prospect: any;
  contacts: RAContact[];
  interactions: RAInteraction[];
  onLeadStatusChange: (status: RALeadStatus) => void;
}

export function RACompanySidebar({ prospect, contacts, interactions, onLeadStatusChange }: RACompanySidebarProps) {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  return (
    <div className="w-96 border-l border-white/5 flex flex-col bg-white/1">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Lead Status */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">Stato Lead</h2>
            <Select value={prospect.lead_status} onValueChange={onLeadStatusChange}>
              <SelectTrigger className="w-full bg-gradient-to-r from-white/10 to-white/5 border-white/10 text-white/95 hover:border-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(240_6%_8%)] border-white/10">
                {LEAD_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status} className="text-white/80">
                    {LEAD_STATUS_LABELS[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <Separator className="bg-white/10" />

          {/* Contacts */}
          <section>
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">Dirigenti ({contacts.length})</h2>
            <div className="space-y-3">
              {contacts.length > 0 ? contacts.map((contact) => (
                <div key={contact.id} onClick={() => setSelectedContactId(selectedContactId === contact.id ? null : contact.id)}
                  className="p-4 rounded-lg border border-white/10 bg-gradient-to-br from-white/10 to-white/5 cursor-pointer transition-all hover:border-white/20 hover:bg-white/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white/95 text-sm">{contact.name}</h3>
                      {contact.role && <p className="text-xs text-white/50 mt-1">{contact.role}</p>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${selectedContactId === contact.id ? "rotate-180" : ""}`} />
                  </div>
                  {selectedContactId === contact.id && (
                    <>
                      <Separator className="my-3 bg-white/10" />
                      <div className="space-y-2">
                        {contact.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-white/40" />
                            <p className="text-xs text-white/70 font-mono break-all">{contact.email}</p>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-white/40" />
                            <p className="text-xs text-white/70 font-mono">{contact.phone}</p>
                          </div>
                        )}
                        {contact.codice_fiscale && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5 text-white/40" />
                            <p className="text-xs text-cyan-400 font-mono">{contact.codice_fiscale}</p>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {contact.email && (
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-white/10 hover:bg-white/10">Scrivi Email</Button>
                          )}
                          {contact.email && (
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-white/10 hover:bg-white/10"
                              onClick={() => navigator.clipboard.writeText(contact.email!)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )) : (
                <p className="text-xs text-white/40 text-center py-4">Nessun dirigente registrato</p>
              )}
            </div>
          </section>

          <Separator className="bg-white/10" />

          {/* Interactions Timeline */}
          {interactions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">Timeline Interazioni</h2>
              <div className="space-y-3">
                {interactions.map((interaction) => (
                  <div key={interaction.id} className="relative">
                    <div className="absolute left-2 top-0 w-0.5 h-full bg-white/10" />
                    <div className="p-3 ml-6 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-white/50">{formatDate(interaction.created_at)}</p>
                          <p className="text-sm font-medium text-white/90 mt-1">{interaction.title}</p>
                          {interaction.description && <p className="text-xs text-white/60 mt-1.5">{interaction.description}</p>}
                        </div>
                        <Badge className="text-xs capitalize flex-shrink-0 bg-white/10 text-white/70 border-white/20">{interaction.interaction_type}</Badge>
                      </div>
                      {interaction.outcome && <p className="text-xs text-white/50 mt-2 pt-2 border-t border-white/10">Esito: {interaction.outcome}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="flex-shrink-0 p-4 border-t border-white/5 space-y-2">
        <Button className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border-0" size="sm">
          <Briefcase className="w-4 h-4 mr-2" /> Deep Search
        </Button>
        <Button variant="outline" className="w-full border-white/10 hover:bg-white/10 text-white/90" size="sm">
          <Building2 className="w-4 h-4 mr-2" /> Aggiungi a CRM
        </Button>
        <Button variant="outline" className="w-full border-white/10 hover:bg-white/10 text-white/90" size="sm">
          <Mail className="w-4 h-4 mr-2" /> Scrivi Email
        </Button>
      </div>
    </div>
  );
}
