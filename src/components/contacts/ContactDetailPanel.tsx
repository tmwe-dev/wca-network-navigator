import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Mail, Phone, MessageCircle, Search, Plus, Building2, User, Sparkles, ChevronDown, Handshake, Loader2, Globe, Linkedin,
} from "lucide-react";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
import { ContactEnrichmentCard } from "./ContactEnrichmentCard";
import { ContactInteractionTimeline } from "./ContactInteractionTimeline";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { type LeadStatus } from "@/hooks/useContacts";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useContactDetail, type ContactDetail } from "@/hooks/useContactDetail";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

interface Props {
  contact: ContactDetail;
  onContactUpdated?: (updatedContact: ContactDetail) => void;
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

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-gradient-to-br from-primary/5 via-card to-primary/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4 space-y-2", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{children}</p>
    </div>
  );
}

function ContactQuickActions({ contact: c }: { contact: ContactDetail }) {
  const { handleSendEmail, handleSendWhatsApp, waSending, waAvailable } = useDirectContactActions();
  const waPhone = c.mobile || c.phone;
  const ed = c.enrichment_data as Record<string, any> | null;
  const linkedinUrl: string | undefined = ed?.linkedin_url || ed?.linkedin_profile_url;
  return (
    <div className="flex flex-wrap gap-1.5">
      {c.email && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10"
          onClick={() => handleSendEmail({ email: c.email!, name: c.contact_alias || c.name || undefined, company: c.company_name || undefined, contactId: c.id, partnerId: (c as { wca_partner_id?: string }).wca_partner_id || undefined })}>
          <Mail className="w-3.5 h-3.5 text-primary" />
          <span className="truncate max-w-[180px]">{c.email}</span>
        </Button>
      )}
      {waPhone && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
          disabled={waSending === c.id || !waAvailable}
          onClick={() => handleSendWhatsApp({ phone: waPhone, contactName: c.contact_alias || c.name || undefined, companyName: c.company_name || undefined, sourceType: "contact", sourceId: c.id })}>
          {waSending === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp
        </Button>
      )}
      {linkedinUrl && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-[#0A66C2]/20 hover:bg-[#0A66C2]/10" asChild>
          <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
            <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" /> LinkedIn
          </a>
        </Button>
      )}
      {(c.phone || c.mobile) && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10" asChild>
          <a href={`tel:${c.phone || c.mobile}`}><Phone className="w-3.5 h-3.5 text-primary" /> {c.phone || c.mobile}</a>
        </Button>
      )}
    </div>
  );
}

export function ContactDetailPanel({ contact, onContactUpdated }: Props) {
  const {
    state, dispatch, interactions: _interactions, matchedCard, needsAlias,
    createInteractionPending, handleGenerateAlias, handleStatusChange, handleAddInteraction,
  } = useContactDetail({ contact, onContactUpdated });

  const c = state.contact;

  return (
    <PageErrorBoundary>
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <Section className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/20 border border-primary/15 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">{c.company_alias || c.company_name || "Senza azienda"}</h2>
            {c.company_alias && c.company_name && c.company_alias !== c.company_name && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.company_name}</p>
            )}
          </div>
          <LeadScoreBadge score={c.lead_score} breakdown={c.lead_score_breakdown} size="md" />
        </div>
        {(c.name || c.contact_alias) && (
          <div className="flex items-center gap-2 ml-[52px]">
            <User className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
            <p className="text-sm text-foreground/80">
              {c.contact_alias || c.name}
              {c.contact_alias && c.name && c.contact_alias !== c.name && <span className="text-muted-foreground text-xs ml-1">({c.name})</span>}
              {c.position && <span className="text-primary"> • {c.position}</span>}
            </p>
            {(c.company_alias || c.contact_alias) && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
          </div>
        )}
        {(c.city || c.country || c.address) && (
          <p className="text-xs text-muted-foreground ml-[52px]">
            {[c.city, c.country].filter(Boolean).join(", ")}{c.address && ` — ${c.address}`}
          </p>
        )}
      </Section>

      <ContactQuickActions contact={c} />
      <div className="flex flex-wrap gap-1.5">
        {c.company_name && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-primary border-primary/20 hover:bg-primary/10"
            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(c.company_name + " logo")}&tbm=isch`, "_blank")}>
            <Globe className="w-3.5 h-3.5" /> Cerca Logo
          </Button>
        )}
        {needsAlias && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-primary border-primary/20 hover:bg-primary/10"
            onClick={handleGenerateAlias} disabled={state.aliasLoading}>
            <Sparkles className="w-3.5 h-3.5" /> {state.aliasLoading ? "Generazione..." : "Genera Alias"}
          </Button>
        )}
      </div>

      <Section>
        <SectionTitle icon={MessageCircle}>Circuito di attesa</SectionTitle>
        <HoldingPatternIndicator status={c.lead_status as LeadStatus} onChangeStatus={handleStatusChange} />
      </Section>

      <div className="flex flex-wrap gap-1.5">
        {c.origin && <Badge variant="outline" className="text-[10px] border-primary/15">{c.origin}</Badge>}
        {c.contact_alias && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0"><Sparkles className="w-2.5 h-2.5 mr-0.5" /> {c.contact_alias}</Badge>}
        {c.deep_search_at && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0"><Search className="w-2.5 h-2.5 mr-0.5" /> Deep Search</Badge>}
        <Badge variant="outline" className="text-[10px] border-primary/15">{c.interaction_count} interazioni</Badge>
      </div>

      {matchedCard && (
        <Section>
          <SectionTitle icon={Handshake}>Biglietto da visita</SectionTitle>
          <div className="flex gap-3 items-start">
            {matchedCard.photo_url && (
              <div className="w-24 shrink-0 rounded-lg overflow-hidden border border-border/50">
                <AspectRatio ratio={16 / 9}>
                  <OptimizedImage src={matchedCard.photo_url} alt="Biglietto" className="w-full h-full object-cover" />
                </AspectRatio>
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              {matchedCard.event_name && <p className="text-xs font-medium text-foreground">{matchedCard.event_name}</p>}
              {matchedCard.met_at && <p className="text-[10px] text-muted-foreground">Incontrato: {format(new Date(matchedCard.met_at), "dd MMM yyyy", { locale: it })}</p>}
              {matchedCard.location && <p className="text-[10px] text-muted-foreground">{matchedCard.location}</p>}
              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-0"><Handshake className="w-2.5 h-2.5 mr-0.5" /> Incontrato personalmente</Badge>
            </div>
          </div>
        </Section>
      )}

      <ContactEnrichmentCard enrichmentData={(c.enrichment_data as Record<string, any> | undefined) ?? null} deepSearchAt={c.deep_search_at} />

      <Collapsible open={state.detailsOpen} onOpenChange={(v) => dispatch({ type: "TOGGLE_DETAILS", value: v })}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-medium">
            <ChevronDown className={cn("w-3 h-3 transition-transform", state.detailsOpen && "rotate-180")} /> Dettagli
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          <div className="text-[11px] text-muted-foreground space-y-0.5 bg-muted/30 rounded-lg p-3 border border-border/50">
            {c.created_at && <p>Importato: {format(new Date(c.created_at), "dd MMM yyyy", { locale: it })}</p>}
            {c.last_interaction_at && <p>Ultima interazione: {format(new Date(c.last_interaction_at), "dd MMM yyyy", { locale: it })}</p>}
          </div>
          {c.note && <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground border border-border/50">{c.note}</div>}
        </CollapsibleContent>
      </Collapsible>

      <Section>
        <div className="flex items-center justify-between">
          <SectionTitle icon={MessageCircle}>Timeline</SectionTitle>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary hover:bg-primary/10" onClick={() => dispatch({ type: "SHOW_INTERACTION", value: true })}>
            <Plus className="w-3 h-3" /> Aggiungi
          </Button>
        </div>
        <ContactInteractionTimeline contactId={contact.id} contactEmail={contact.email} />
      </Section>

      <Dialog open={state.showNewInteraction} onOpenChange={(v) => dispatch({ type: "SHOW_INTERACTION", value: v })}>
        <DialogContent className="max-w-sm bg-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nuova Interazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={state.newType} onValueChange={(v) => dispatch({ type: "SET_NEW_TYPE", value: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={state.newTitle} onChange={(e) => dispatch({ type: "SET_NEW_TITLE", value: e.target.value })} placeholder="Titolo" className="h-8 text-xs" />
            <Textarea value={state.newDesc} onChange={(e) => dispatch({ type: "SET_NEW_DESC", value: e.target.value })} placeholder="Descrizione (opzionale)" className="text-xs min-h-[60px]" />
            <Select value={state.newOutcome} onValueChange={(v) => dispatch({ type: "SET_NEW_OUTCOME", value: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Esito (opzionale)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuno</SelectItem>
                <SelectItem value="positive">Positivo</SelectItem>
                <SelectItem value="neutral">Neutro</SelectItem>
                <SelectItem value="negative">Negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button size="sm" className="text-xs gap-1.5" onClick={handleAddInteraction} disabled={createInteractionPending}>
              {createInteractionPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Registra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageErrorBoundary>
  );
}
