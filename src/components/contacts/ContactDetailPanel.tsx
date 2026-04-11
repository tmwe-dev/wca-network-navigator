import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Mail, Phone, MessageCircle, Search, Plus, Building2, User, Sparkles, ChevronDown, Handshake, Loader2, Globe,
} from "lucide-react";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { ContactEnrichmentCard } from "./ContactEnrichmentCard";
import { ContactInteractionTimeline } from "./ContactInteractionTimeline";
import {
  useContactInteractions,
  useUpdateLeadStatus,
  useCreateContactInteraction,
  type LeadStatus,
} from "@/hooks/useContacts";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  company_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  origin: string | null;
  position: string | null;
  lead_status: string;
  deep_search_at: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  created_at: string;
  company_alias: string | null;
  contact_alias: string | null;
  note: string | null;
  enrichment_data?: any;
}

interface Props {
  contact: Contact;
  onContactUpdated?: (updatedContact: Contact) => void;
}

const INTERACTION_TYPES = [
  { value: "email_sent", label: "Email inviata" },
  { value: "phone_call", label: "Chiamata" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meeting", label: "Incontro" },
  { value: "note", label: "Nota" },
];

function formatPhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

/* ═══ Section wrapper — glassmorphism style ═══ */
function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 backdrop-blur-sm border border-violet-500/10 rounded-2xl p-4 space-y-2",
      className
    )}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.5} />
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{children}</p>
    </div>
  );
}

function ContactQuickActions({ contact: c }: { contact: Contact }) {
  const { handleSendEmail, handleSendWhatsApp, waSending, waAvailable } = useDirectContactActions();
  const waPhone = c.mobile || c.phone;
  return (
    <div className="flex flex-wrap gap-1.5">
      {c.email && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-violet-500/15 hover:bg-violet-500/10"
          onClick={() => handleSendEmail({ email: c.email!, name: c.contact_alias || c.name || undefined, company: c.company_name || undefined })}
        >
          <Mail className="w-3.5 h-3.5 text-violet-400" />
          <span className="truncate max-w-[180px]">{c.email}</span>
        </Button>
      )}
      {waPhone && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
          disabled={waSending === c.id || !waAvailable}
          onClick={() => handleSendWhatsApp({ phone: waPhone, contactName: c.contact_alias || c.name || undefined, companyName: c.company_name || undefined, sourceType: "contact", sourceId: c.id })}
        >
          {waSending === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp
        </Button>
      )}
      {(c.phone || c.mobile) && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-violet-500/15 hover:bg-violet-500/10" asChild>
          <a href={`tel:${c.phone || c.mobile}`}>
            <Phone className="w-3.5 h-3.5 text-violet-400" /> {c.phone || c.mobile}
          </a>
        </Button>
      )}
    </div>
  );
}

export function ContactDetailPanel({ contact, onContactUpdated }: Props) {
  const [c, setC] = useState<Contact>(contact);
  const { data: interactions = [] } = useContactInteractions(c.id);
  const updateStatus = useUpdateLeadStatus();
  const createInteraction = useCreateContactInteraction();
  const queryClient = useQueryClient();
  const [showNewInteraction, setShowNewInteraction] = useState(false);
  const [newType, setNewType] = useState("note");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newOutcome, setNewOutcome] = useState("");
  const [aliasLoading, setAliasLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Query matched business card for this contact
  const { data: matchedCard } = useQuery({
    queryKey: ["business-card-for-contact", c.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_cards")
        .select("*")
        .eq("matched_contact_id", c.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 120_000,
  });

  // Sync with external prop changes (e.g. user clicks different contact)
  useEffect(() => {
    setC(contact);
  }, [contact]);

  const needsAlias = !c.company_alias && !c.contact_alias;

  const handleGenerateAlias = async () => {
    if (aliasLoading) return;
    setAliasLoading(true);
    try {
      const data = await invokeEdge<any>("generate-aliases", { body: { contactIds: [c.id] }, context: "ContactDetailPanel.generate_aliases" });
      const processed = data?.processed || 0;
      if (processed === 0) {
        toast({ title: "Alias già presente", description: "Questo contatto ha già un alias generato" });
      } else {
        toast({ title: "✨ Alias generato", description: `${processed} contatti elaborati con successo` });
      }

      // Refetch the contact from DB to update the panel
      const { getContactById } = await import("@/data/contacts");
      const updated = await getContactById(c.id).catch(() => null);

      if (updated) {
        setC(updated as Contact);
        onContactUpdated?.(updated as Contact);
      }

      queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setAliasLoading(false);
    }
  };

  const handleStatusChange = (s: LeadStatus) => {
    updateStatus.mutate(
      { ids: [c.id], status: s },
      {
        onSuccess: () => {
          toast({ title: "Status aggiornato" });
          setC((prev) => ({ ...prev, lead_status: s }));
        },
      }
    );
  };

  const handleAddInteraction = () => {
    if (!newTitle.trim()) return;
    createInteraction.mutate(
      {
        contact_id: c.id,
        interaction_type: newType,
        title: newTitle,
        description: newDesc || undefined,
        outcome: newOutcome && newOutcome !== "none" ? newOutcome : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Interazione registrata" });
          setShowNewInteraction(false);
          setNewTitle("");
          setNewDesc("");
          setNewOutcome("");
          setC((prev) => ({ ...prev, interaction_count: prev.interaction_count + 1 }));
        },
      }
    );
  };

  const waPhone = c.mobile || c.phone;
  const whatsappUrl = waPhone ? `https://wa.me/${formatPhone(waPhone)}` : null;

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      {/* Header — glassmorphism */}
      <Section className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/15 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {c.company_alias || c.company_name || "Senza azienda"}
            </h2>
            {c.company_alias && c.company_name && c.company_alias !== c.company_name && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.company_name}</p>
            )}
          </div>
        </div>

        {(c.name || c.contact_alias) && (
          <div className="flex items-center gap-2 ml-[52px]">
            <User className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
            <p className="text-sm text-foreground/80">
              {c.contact_alias || c.name}
              {c.contact_alias && c.name && c.contact_alias !== c.name && (
                <span className="text-muted-foreground text-xs ml-1">({c.name})</span>
              )}
              {c.position && <span className="text-violet-400"> • {c.position}</span>}
            </p>
            {(c.company_alias || c.contact_alias) && (
              <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
            )}
          </div>
        )}

        {(c.city || c.country || c.address) && (
          <p className="text-xs text-muted-foreground ml-[52px]">
            {[c.city, c.country].filter(Boolean).join(", ")}
            {c.address && ` — ${c.address}`}
          </p>
        )}
      </Section>

      {/* Quick actions — icon buttons */}
      <ContactQuickActions contact={c} />
      <div className="flex flex-wrap gap-1.5">
        {c.company_name && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-primary border-primary/20 hover:bg-primary/10"
            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(c.company_name + " logo")}&tbm=isch`, "_blank")}
          >
            <Globe className="w-3.5 h-3.5" />
            Cerca Logo
          </Button>
        )}
        {needsAlias && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-violet-400 border-violet-500/20 hover:bg-violet-500/10"
            onClick={handleGenerateAlias}
            disabled={aliasLoading}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aliasLoading ? "Generazione..." : "Genera Alias"}
          </Button>
        )}
      </div>

      {/* Holding pattern */}
      <Section>
        <SectionTitle icon={MessageCircle}>Circuito di attesa</SectionTitle>
        <HoldingPatternIndicator
          status={c.lead_status as LeadStatus}
          onChangeStatus={handleStatusChange}
        />
      </Section>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {c.origin && <Badge variant="outline" className="text-[10px] border-violet-500/15">{c.origin}</Badge>}
        {c.contact_alias && (
          <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-300 border-0">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" /> {c.contact_alias}
          </Badge>
        )}
        {c.deep_search_at && (
          <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0">
            <Search className="w-2.5 h-2.5 mr-0.5" /> Deep Search
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] border-violet-500/15">
          {c.interaction_count} interazioni
        </Badge>
      </div>

      {/* Business card miniature */}
      {matchedCard && (
        <Section>
          <SectionTitle icon={Handshake}>Biglietto da visita</SectionTitle>
          <div className="flex gap-3 items-start">
            {matchedCard.photo_url && (
              <div className="w-24 shrink-0 rounded-lg overflow-hidden border border-border/50">
                <AspectRatio ratio={16 / 9}>
                  <img
                    src={matchedCard.photo_url}
                    alt="Biglietto"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </AspectRatio>
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              {matchedCard.event_name && (
                <p className="text-xs font-medium text-foreground">{matchedCard.event_name}</p>
              )}
              {matchedCard.met_at && (
                <p className="text-[10px] text-muted-foreground">
                  Incontrato: {format(new Date(matchedCard.met_at), "dd MMM yyyy", { locale: it })}
                </p>
              )}
              {matchedCard.location && (
                <p className="text-[10px] text-muted-foreground">{matchedCard.location}</p>
              )}
              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-0">
                <Handshake className="w-2.5 h-2.5 mr-0.5" /> Incontrato personalmente
              </Badge>
            </div>
          </div>
        </Section>
      )}

      {/* Enrichment Card */}
      <ContactEnrichmentCard
        enrichmentData={c.enrichment_data}
        deepSearchAt={c.deep_search_at}
      />

      {/* Collapsible details */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-medium">
            <ChevronDown className={cn("w-3 h-3 transition-transform", detailsOpen && "rotate-180")} />
            Dettagli
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          <div className="text-[11px] text-muted-foreground space-y-0.5 bg-muted/30 rounded-lg p-3 border border-border/50">
            {c.created_at && <p>Importato: {format(new Date(c.created_at), "dd MMM yyyy", { locale: it })}</p>}
            {c.last_interaction_at && (
              <p>Ultima interazione: {format(new Date(c.last_interaction_at), "dd MMM yyyy", { locale: it })}</p>
            )}
          </div>
          {c.note && (
            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground border border-border/50">{c.note}</div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Timeline */}
      <Section>
        <div className="flex items-center justify-between">
          <SectionTitle icon={MessageCircle}>Timeline</SectionTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-violet-400 hover:bg-violet-500/10"
            onClick={() => setShowNewInteraction(true)}
          >
            <Plus className="w-3 h-3" /> Aggiungi
          </Button>
        </div>
        <ContactInteractionTimeline interactions={interactions} />
      </Section>

      {/* New interaction dialog */}
      <Dialog open={showNewInteraction} onOpenChange={setShowNewInteraction}>
        <DialogContent className="max-w-sm bg-card border-violet-500/20">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-400" /> Nuova Interazione
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titolo"
              className="h-8 text-xs"
            />
            <Textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descrizione (opzionale)"
              className="text-xs min-h-[60px]"
            />
            <Select value={newOutcome} onValueChange={setNewOutcome}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Esito (opzionale)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuno</SelectItem>
                <SelectItem value="positive">Positivo</SelectItem>
                <SelectItem value="neutral">Neutro</SelectItem>
                <SelectItem value="negative">Negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button size="sm" className="text-xs" onClick={handleAddInteraction} disabled={!newTitle.trim()}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
