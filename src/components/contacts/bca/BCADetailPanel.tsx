import { useState, useCallback } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, MessageCircle, Send, Handshake, Globe, Loader2, Search, Briefcase, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BCAOcrConfidence } from "./BCAOcrConfidence";
import { BCACreateContact } from "./BCACreateContact";
import { BCASmartActions } from "./BCASmartActions";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { searchPartnersByNameAlias } from "@/data/partners";
import { useUpdateBusinessCard, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { toast } from "@/hooks/use-toast";
import { STATUS_COLORS, STATUS_LABELS, countryFlag, googleLogoSearchUrl } from "./bcaUtils";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";

/* ═══ Manual Partner Matcher ═══ */
function ManualPartnerMatcher({ card }: { card: BusinessCardWithPartner }) {
  const [searchTerm, setSearchTerm] = useState(card.company_name || "");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const updateCard = useUpdateBusinessCard();

  const doSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setSearching(true); setSearched(true);
    try {
      const data = await searchPartnersByNameAlias(searchTerm.trim(), "id, company_name, company_alias, country_code, country_name, city");
      setResults(data ?? []);
    } catch (e: unknown) { toast({ title: "Errore ricerca", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setSearching(false); }
  }, [searchTerm]);

  const confirmMatch = useCallback(async (partnerId: string) => {
    try {
      await updateCard.mutateAsync({ id: card.id, matched_partner_id: partnerId, match_status: "matched", match_confidence: 100 });
      toast({ title: "✅ Match confermato" });
    } catch (e: unknown) { toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  }, [card.id, updateCard]);

  return (
    <div className="space-y-2 bg-primary/5 rounded-lg p-3 border border-primary/15">
      <p className="text-[10px] text-primary uppercase tracking-wider font-medium flex items-center gap-1"><Search className="w-3 h-3" /> Cerca partner WCA</p>
      <div className="flex gap-1.5">
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Nome azienda..." className="h-7 text-xs flex-1" />
        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0" onClick={doSearch} disabled={searching}>
          {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        </Button>
      </div>
      {searched && results.length === 0 && !searching && <p className="text-[10px] text-muted-foreground">Nessun partner trovato</p>}
      {results.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {results.map((p) => (
            <button key={p.id} className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group" onClick={() => confirmMatch(p.id)}>
              <div className="flex items-center gap-2">
                <span className="text-xs shrink-0">{countryFlag(p.country_code) || "🌍"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{p.company_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{[p.city, p.country_name].filter(Boolean).join(", ")}</p>
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Detail Side Panel ═══ */
export function BusinessCardDetailPanel({ card, onClose: _onClose }: { card: BusinessCardWithPartner; onClose: () => void }) {
  const navigate = useAppNavigate();
  const { handleSendEmail, handleSendWhatsApp, waSending, waAvailable } = useDirectContactActions();
  const waPhone = card.mobile || card.phone;

  const _handleCockpit = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await insertCockpitQueueItems([{ source_id: card.id, source_type: "business_card", user_id: user.id, partner_id: card.matched_partner_id || null }]);
      toast({ title: "✅ Aggiunto al Cockpit" });
    } catch (e: unknown) { toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  }, [card]);

  const handleWorkspace = useCallback(() => {
    if (!card.email) { toast({ title: "Email mancante", variant: "destructive" }); return; }
    navigate("/email-composer", { state: { prefilledRecipient: { email: card.email, name: card.contact_name || undefined, company: card.company_name || undefined, partnerId: card.matched_partner_id || undefined } } });
  }, [card, navigate]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{card.company_name || "Senza azienda"}</h2>
            {card.contact_name && <p className="text-xs text-muted-foreground truncate">{card.contact_name}{card.position ? ` · ${card.position}` : ""}</p>}
          </div>
        </div>
        {card.partner && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
            {card.partner.logo_url && <img src={card.partner.logo_url} alt="" className="w-6 h-6 rounded object-contain" />}
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-emerald-400">Partner WCA Matchato</p>
              <p className="text-xs text-foreground truncate">{card.partner.company_name}</p>
            </div>
          </div>
        )}
      </div>

      {card.photo_url && (
        <div className="rounded-lg overflow-hidden border border-border/30">
          <img src={card.photo_url} alt="Biglietto" className="w-full object-contain" loading="lazy" />
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1"><Send className="w-3 h-3" /> Azioni rapide</p>
        <div className="grid grid-cols-2 gap-1.5">
          {card.email && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10 justify-start"
              onClick={() => handleSendEmail({ email: card.email!, name: card.contact_name || undefined, company: card.company_name || undefined, partnerId: card.partner?.id })}>
              <Mail className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate">Email</span>
            </Button>
          )}
          {waPhone && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-emerald-500/15 hover:bg-emerald-500/10 justify-start"
              disabled={waSending === card.id || !waAvailable}
              onClick={() => handleSendWhatsApp({ phone: waPhone, contactName: card.contact_name || undefined, companyName: card.company_name || undefined, sourceType: "contact", sourceId: card.id, partnerId: card.partner?.id || undefined })}>
              {waSending === card.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              <span className="truncate">WhatsApp</span>
            </Button>
          )}
          {(card.phone || card.mobile) && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10 justify-start" asChild>
              <a href={`tel:${card.phone || card.mobile}`}><Phone className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate">Chiama</span></a>
            </Button>
          )}
          {card.email && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/15 hover:bg-primary/10 justify-start" onClick={handleWorkspace}>
              <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate">Workspace</span>
            </Button>
          )}
        </div>
      </div>

      {/* Smart Actions */}
      <BCASmartActions card={card} />

      {/* OCR Confidence */}
      <BCAOcrConfidence card={card} />

      {/* Create Contact */}
      <BCACreateContact card={card} />

      <div className="space-y-1.5 bg-muted/20 rounded-lg p-3 border border-border/30">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Dettagli contatto</p>
        {card.email && <div className="flex items-center gap-2 text-xs text-foreground"><Mail className="w-3.5 h-3.5 text-primary shrink-0" /> <span className="truncate">{card.email}</span></div>}
        {card.phone && <div className="flex items-center gap-2 text-xs text-foreground"><Phone className="w-3.5 h-3.5 text-primary shrink-0" /> {card.phone}</div>}
        {card.mobile && card.mobile !== card.phone && <div className="flex items-center gap-2 text-xs text-foreground"><Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {card.mobile}</div>}
      </div>

      {card.event_name && (
        <div className="space-y-1 bg-primary/5 rounded-lg p-3 border border-primary/10">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Evento</p>
          <div className="flex items-center gap-1.5"><Handshake className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-foreground">{card.event_name}</span></div>
          {card.met_at && <p className="text-[10px] text-muted-foreground ml-5">{format(new Date(card.met_at), "dd MMMM yyyy", { locale: it })}</p>}
          {card.location && <p className="text-[10px] text-muted-foreground ml-5">{card.location}</p>}
        </div>
      )}

      <div className="space-y-2 bg-gradient-to-br from-primary/5 via-card to-primary/5 rounded-lg p-3 border border-primary/10">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Stato</p>
        <Badge className={cn("text-[10px]", STATUS_COLORS[card.match_status] || STATUS_COLORS.pending)}>{STATUS_LABELS[card.match_status] || "In attesa"}</Badge>
        {card.match_confidence > 0 && <p className="text-[10px] text-muted-foreground">Confidenza match: {Math.round(card.match_confidence)}%</p>}
      </div>

      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">{card.tags.map((t) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}</div>
      )}

      {card.notes && (() => {
        const isGarbled = /[;|]{3,}|[\x00-\x1f]/.test(card.notes);
        return (
          <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border/30">
            {isGarbled ? (
              <>{card.notes.slice(0, 120)}... <span className="text-muted-foreground/50 italic">(dati grezzi)</span></>
            ) : card.notes}
          </div>
        );
      })()}

      {card.company_name && (
        <Button variant="outline" size="sm" className="w-full text-xs gap-2 border-primary/15 hover:bg-primary/10"
          onClick={() => window.open(googleLogoSearchUrl(card.company_name!), "_blank")}>
          <Globe className="w-3.5 h-3.5 text-primary" /> Cerca logo su Google
        </Button>
      )}

      {card.match_status !== "matched" && <ManualPartnerMatcher card={card} />}
    </div>
  );
}
