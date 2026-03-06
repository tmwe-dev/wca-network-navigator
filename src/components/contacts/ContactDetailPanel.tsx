import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Phone, MessageCircle, Search, Plus, Building2, User, Sparkles, RefreshCw } from "lucide-react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";
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
import { useQueryClient } from "@tanstack/react-query";

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
}

interface Props {
  contact: Contact;
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

export function ContactDetailPanel({ contact }: Props) {
  const c = contact;
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

  const needsAlias = !c.company_alias || !c.contact_alias;

  const handleGenerateAlias = async () => {
    if (aliasLoading) return;
    setAliasLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", {
        body: { contactIds: [c.id] },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-items"] });
      toast({ title: "Alias generato", description: `${data?.processed || 0} contatti elaborati` });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setAliasLoading(false);
    }
  };

  const handleStatusChange = (s: LeadStatus) => {
    updateStatus.mutate(
      { ids: [c.id], status: s },
      { onSuccess: () => toast({ title: "Status aggiornato" }) }
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
        },
      }
    );
  };

  const waPhone = c.mobile || c.phone;
  const whatsappUrl = waPhone ? `https://wa.me/${formatPhone(waPhone)}` : null;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Header — clear company vs contact distinction */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary/60 shrink-0" />
          <h2 className="text-base font-bold text-foreground truncate">
            {c.company_name || "Senza azienda"}
          </h2>
        </div>
        {c.company_alias && (
          <div className="flex items-center gap-1.5 ml-6">
            <Sparkles className="w-3 h-3 text-primary/50" />
            <span className="text-[11px] text-primary/70 italic">{c.company_alias}</span>
          </div>
        )}
        {c.name && (
          <div className="flex items-center gap-2 ml-6">
            <User className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {c.name}
              {c.position && <span className="text-primary/70"> • {c.position}</span>}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground ml-6">
          {[c.city, c.country].filter(Boolean).join(", ")}
          {c.address && ` — ${c.address}`}
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {c.email && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
            <a href={`mailto:${c.email}`}>
              <Mail className="w-3 h-3" /> Email
            </a>
          </Button>
        )}
        {whatsappUrl && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-success border-success/30 hover:bg-success/5" asChild>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </a>
          </Button>
        )}
        {(c.phone || c.mobile) && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
            <a href={`tel:${c.phone || c.mobile}`}>
              <Phone className="w-3 h-3" /> Chiama
            </a>
          </Button>
        )}
        {needsAlias && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
            onClick={handleGenerateAlias}
            disabled={aliasLoading}
          >
            <Sparkles className="w-3 h-3" />
            {aliasLoading ? "Generazione..." : "Genera Alias"}
          </Button>
        )}
      </div>

      {/* Holding pattern */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Circuito di attesa</p>
        <HoldingPatternIndicator
          status={c.lead_status as LeadStatus}
          onChangeStatus={handleStatusChange}
        />
      </div>

      {/* Badges info */}
      <div className="flex flex-wrap gap-1.5">
        {c.origin && <Badge variant="outline" className="text-[10px]">{c.origin}</Badge>}
        {c.contact_alias && <Badge variant="secondary" className="text-[10px]">Alias contatto: {c.contact_alias}</Badge>}
        {c.deep_search_at && (
          <Badge className="text-[10px] bg-success/20 text-success border-0">
            <Search className="w-2.5 h-2.5 mr-0.5" /> Deep Search
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {c.interaction_count} interazioni
        </Badge>
      </div>

      {/* Dates */}
      <div className="text-[11px] text-muted-foreground space-y-0.5">
        {c.created_at && <p>Importato: {format(new Date(c.created_at), "dd MMM yyyy", { locale: it })}</p>}
        {c.last_interaction_at && (
          <p>Ultima interazione: {format(new Date(c.last_interaction_at), "dd MMM yyyy", { locale: it })}</p>
        )}
      </div>

      {c.note && (
        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{c.note}</div>
      )}

      {/* Timeline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Timeline</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setShowNewInteraction(true)}
          >
            <Plus className="w-3 h-3" /> Aggiungi
          </Button>
        </div>
        <ContactInteractionTimeline interactions={interactions} />
      </div>

      {/* New interaction dialog */}
      <Dialog open={showNewInteraction} onOpenChange={setShowNewInteraction}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Nuova Interazione</DialogTitle>
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
