import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  TrendingUp,
  Users,
  DollarSign,
  Star,
  Download,
  Copy,
  Building2,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRAProspect, useRAProspectContacts, useRAProspectInteractions, useUpdateRALeadStatus } from "@/hooks/useRAProspects";
import type { RALeadStatus, RAContact, RAInteraction } from "@/types/ra";

function formatCurrency(n: number | null) {
  if (!n) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const LEAD_STATUS_LABELS: Record<RALeadStatus, { label: string; color: string }> = {
  new: { label: "Nuovo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  contacted: { label: "Contattato", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  qualified: { label: "Qualificato", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  negotiation: { label: "Negoziazione", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  converted: { label: "Convertito", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  lost: { label: "Perso", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const LEAD_STATUS_OPTIONS: RALeadStatus[] = ["new", "contacted", "qualified", "negotiation", "converted", "lost"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0 hover:bg-cyan-500/10"
      onClick={handleCopy}
    >
      <Copy className="w-4 h-4" />
    </Button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-b from-[hsl(240_6%_3%)] via-[hsl(240_6%_5%)] to-[hsl(240_6%_3%)]">
      <div className="flex-shrink-0 p-6 border-b border-white/5 bg-white/2 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-8 w-48 rounded-lg bg-white/10 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-32 rounded-full bg-white/10 animate-pulse" />
          <div className="h-6 w-32 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400/50 animate-spin" />
      </div>
    </div>
  );
}

function ErrorState() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-b from-[hsl(240_6%_3%)] via-[hsl(240_6%_5%)] to-[hsl(240_6%_3%)]">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="p-3 rounded-full bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white/90">Azienda non trovata</h2>
          <p className="text-sm text-white/60 mt-1">
            L'azienda che stai cercando non esiste o è stata eliminata
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/ra/explorer")}
          className="border-white/10 hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna a Explorer
        </Button>
      </div>
    </div>
  );
}

export default function RACompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { data: prospect, isLoading: prospectLoading, error: prospectError } = useRAProspect(id);
  const { data: contacts = [] } = useRAProspectContacts(id);
  const { data: interactions = [] } = useRAProspectInteractions(id);
  const updateLeadStatus = useUpdateRALeadStatus();

  const isLoading = prospectLoading;

  if (prospectError || (!isLoading && !prospect)) {
    return <ErrorState />;
  }

  if (isLoading || !prospect) {
    return <LoadingSkeleton />;
  }

  const handleLeadStatusChange = (newStatus: RALeadStatus) => {
    updateLeadStatus.mutate({ id: prospect.id, status: newStatus });
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-b from-[hsl(240_6%_3%)] via-[hsl(240_6%_5%)] to-[hsl(240_6%_3%)]">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-white/5 bg-white/2 backdrop-blur-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-white/10"
                onClick={() => navigate("/ra/explorer")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-white/95">{prospect.company_name}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {prospect.city && (
                <Badge className="gap-1 bg-white/10 text-white/80 border border-white/20">
                  {prospect.city}
                  {prospect.province && `, ${prospect.province}`}
                </Badge>
              )}
              {prospect.codice_ateco && (
                <Badge className="gap-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {prospect.codice_ateco}
                </Badge>
              )}
              {prospect.lead_status && (
                <Badge
                  className={`gap-1 border ${
                    LEAD_STATUS_LABELS[prospect.lead_status]?.color
                  }`}
                >
                  {LEAD_STATUS_LABELS[prospect.lead_status]?.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 hover:bg-white/5"
            >
              <Download className="w-4 h-4 mr-1" />
              Esporta
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 bg-white/1">
        <div className="grid grid-cols-4 gap-4">
          {/* Fatturato */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Fatturato
              </span>
            </div>
            <div className="text-2xl font-bold text-white/95">
              {formatCurrency(prospect.fatturato)}
            </div>
            {prospect.fatturato && prospect.utile && (
              <p className="text-xs text-white/50 mt-1">
                Margine: {((prospect.utile / prospect.fatturato) * 100).toFixed(1)}%
              </p>
            )}
          </div>

          {/* Utile */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Utile
              </span>
            </div>
            <div className="text-2xl font-bold text-white/95">
              {formatCurrency(prospect.utile)}
            </div>
            {prospect.anno_bilancio && (
              <p className="text-xs text-white/50 mt-1">
                Anno {prospect.anno_bilancio}
              </p>
            )}
          </div>

          {/* Dipendenti */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Dipendenti
              </span>
            </div>
            <div className="text-2xl font-bold text-white/95">
              {prospect.dipendenti ?? "—"}
            </div>
            <p className="text-xs text-white/50 mt-1">Organico</p>
          </div>

          {/* Credit Score */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Credit Score
              </span>
            </div>
            <div className="text-2xl font-bold text-white/95">
              {prospect.credit_score ?? "—"}
            </div>
            <div className="text-xs text-white/50 mt-1">
              {prospect.rating_affidabilita || "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Company Info */}
        <div className="flex-1 border-r border-white/5 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Anagrafe */}
              <section>
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
                  Informazioni Anagrafiche
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  {prospect.partita_iva && (
                    <div>
                      <label className="text-xs font-medium text-white/50">P.IVA</label>
                      <p className="text-sm font-mono text-cyan-400 mt-1.5">
                        {prospect.partita_iva}
                      </p>
                    </div>
                  )}
                  {prospect.codice_fiscale && (
                    <div>
                      <label className="text-xs font-medium text-white/50">
                        Codice Fiscale
                      </label>
                      <p className="text-sm font-mono text-cyan-400 mt-1.5">
                        {prospect.codice_fiscale}
                      </p>
                    </div>
                  )}
                  {prospect.address && (
                    <div>
                      <label className="text-xs font-medium text-white/50">Indirizzo</label>
                      <p className="text-sm text-white/80 mt-1.5">
                        {prospect.address}
                        {prospect.cap && `, ${prospect.cap}`}
                      </p>
                    </div>
                  )}
                  {prospect.city && (
                    <div>
                      <label className="text-xs font-medium text-white/50">Città</label>
                      <p className="text-sm text-white/80 mt-1.5">
                        {prospect.city}
                        {prospect.province && ` (${prospect.province})`}
                      </p>
                    </div>
                  )}
                  {prospect.region && (
                    <div>
                      <label className="text-xs font-medium text-white/50">Regione</label>
                      <p className="text-sm text-white/80 mt-1.5">{prospect.region}</p>
                    </div>
                  )}
                  {prospect.data_costituzione && (
                    <div>
                      <label className="text-xs font-medium text-white/50">
                        Fondazione
                      </label>
                      <p className="text-sm text-white/80 mt-1.5">
                        {new Date(prospect.data_costituzione).getFullYear()}
                      </p>
                    </div>
                  )}
                  {prospect.forma_giuridica && (
                    <div>
                      <label className="text-xs font-medium text-white/50">
                        Forma Giuridica
                      </label>
                      <p className="text-sm text-white/80 mt-1.5">
                        {prospect.forma_giuridica}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <Separator className="bg-white/10" />

              {/* Settore ATECO */}
              {prospect.codice_ateco && (
                <>
                  <section>
                    <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
                      Settore Economico
                    </h2>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-white/50">
                            Codice ATECO
                          </label>
                          <p className="text-lg font-mono font-bold text-cyan-400 mt-1.5">
                            {prospect.codice_ateco}
                          </p>
                        </div>
                        {prospect.descrizione_ateco && (
                          <div>
                            <label className="text-xs font-medium text-white/50">
                              Descrizione
                            </label>
                            <p className="text-sm text-white/80 mt-1.5">
                              {prospect.descrizione_ateco}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-white/10" />
                </>
              )}

              {/* Contatti */}
              <section>
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
                  Contatti
                </h2>
                <div className="space-y-3">
                  {prospect.website && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-colors">
                      <Briefcase className="w-4 h-4 text-white/60 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/50">Website</p>
                        <p className="text-sm text-white/80 truncate">
                          {prospect.website}
                        </p>
                      </div>
                      <CopyButton text={prospect.website} />
                    </div>
                  )}
                  {prospect.email && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-colors">
                      <Mail className="w-4 h-4 text-white/60 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/50">Email</p>
                        <p className="text-sm text-white/80 truncate">
                          {prospect.email}
                        </p>
                      </div>
                      <CopyButton text={prospect.email} />
                    </div>
                  )}
                  {prospect.pec && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-colors">
                      <Mail className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/50">PEC</p>
                        <p className="text-sm text-white/80 truncate">{prospect.pec}</p>
                      </div>
                      <CopyButton text={prospect.pec} />
                    </div>
                  )}
                  {prospect.phone && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-colors">
                      <Phone className="w-4 h-4 text-white/60 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/50">Telefono</p>
                        <p className="text-sm text-white/80 truncate">
                          {prospect.phone}
                        </p>
                      </div>
                      <CopyButton text={prospect.phone} />
                    </div>
                  )}
                </div>
              </section>

              <Separator className="bg-white/10" />

              {/* Dati Finanziari */}
              <section>
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
                  Dati Finanziari
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl">
                    <p className="text-xs text-white/50 font-medium">Fatturato Medio</p>
                    <p className="text-lg font-bold text-white/95 mt-2">
                      {formatCurrency(prospect.fatturato)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl">
                    <p className="text-xs text-white/50 font-medium">Utile Netto</p>
                    <p className="text-lg font-bold text-white/95 mt-2">
                      {formatCurrency(prospect.utile)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl">
                    <p className="text-xs text-white/50 font-medium">Margine Netto</p>
                    <p className="text-lg font-bold text-white/95 mt-2">
                      {prospect.fatturato && prospect.utile
                        ? `${((prospect.utile / prospect.fatturato) * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        {/* Right Column: Contacts & Interactions */}
        <div className="w-96 border-l border-white/5 flex flex-col bg-white/1">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Lead Status Selector */}
              <section>
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">
                  Stato Lead
                </h2>
                <Select value={prospect.lead_status} onValueChange={handleLeadStatusChange}>
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

              {/* Dirigenti */}
              <section>
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
                  Dirigenti ({contacts.length})
                </h2>
                <div className="space-y-3">
                  {contacts.length > 0 ? (
                    contacts.map((contact: RAContact) => (
                      <div
                        key={contact.id}
                        onClick={() =>
                          setSelectedContactId(
                            selectedContactId === contact.id ? null : contact.id
                          )
                        }
                        className="p-4 rounded-lg border border-white/10 bg-gradient-to-br from-white/10 to-white/5 cursor-pointer transition-all hover:border-white/20 hover:bg-white/10"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-white/95 text-sm">
                              {contact.name}
                            </h3>
                            {contact.role && (
                              <p className="text-xs text-white/50 mt-1">{contact.role}</p>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-white/40 transition-transform ${
                              selectedContactId === contact.id ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                        {selectedContactId === contact.id && (
                          <>
                            <Separator className="my-3 bg-white/10" />
                            <div className="space-y-2">
                              {contact.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3.5 h-3.5 text-white/40" />
                                  <p className="text-xs text-white/70 font-mono break-all">
                                    {contact.email}
                                  </p>
                                </div>
                              )}
                              {contact.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-white/40" />
                                  <p className="text-xs text-white/70 font-mono">
                                    {contact.phone}
                                  </p>
                                </div>
                              )}
                              {contact.codice_fiscale && (
                                <div className="flex items-center gap-2">
                                  <Briefcase className="w-3.5 h-3.5 text-white/40" />
                                  <p className="text-xs text-cyan-400 font-mono">
                                    {contact.codice_fiscale}
                                  </p>
                                </div>
                              )}
                              <div className="flex gap-2 mt-3">
                                {contact.email && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-7 text-xs border-white/10 hover:bg-white/10"
                                  >
                                    Scrivi Email
                                  </Button>
                                )}
                                {contact.email && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0 border-white/10 hover:bg-white/10"
                                    onClick={() => handleCopyText(contact.email!)}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/40 text-center py-4">
                      Nessun dirigente registrato
                    </p>
                  )}
                </div>
              </section>

              <Separator className="bg-white/10" />

              {/* Timeline Interazioni */}
              {interactions.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
                    Timeline Interazioni
                  </h2>
                  <div className="space-y-3">
                    {interactions.map((interaction: RAInteraction) => (
                      <div key={interaction.id} className="relative">
                        <div className="absolute left-2 top-0 w-0.5 h-full bg-white/10" />
                        <div className="p-3 ml-6 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-white/50">
                                {formatDate(interaction.created_at)}
                              </p>
                              <p className="text-sm font-medium text-white/90 mt-1">
                                {interaction.title}
                              </p>
                              {interaction.description && (
                                <p className="text-xs text-white/60 mt-1.5">
                                  {interaction.description}
                                </p>
                              )}
                            </div>
                            <Badge
                              className={`text-xs capitalize flex-shrink-0 bg-white/10 text-white/70 border-white/20`}
                            >
                              {interaction.interaction_type}
                            </Badge>
                          </div>
                          {interaction.outcome && (
                            <p className="text-xs text-white/50 mt-2 pt-2 border-t border-white/10">
                              Esito: {interaction.outcome}
                            </p>
                          )}
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
            <Button
              className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border-0"
              size="sm"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Deep Search
            </Button>
            <Button
              variant="outline"
              className="w-full border-white/10 hover:bg-white/10 text-white/90"
              size="sm"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Aggiungi a CRM
            </Button>
            <Button
              variant="outline"
              className="w-full border-white/10 hover:bg-white/10 text-white/90"
              size="sm"
            >
              <Mail className="w-4 h-4 mr-2" />
              Scrivi Email
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
