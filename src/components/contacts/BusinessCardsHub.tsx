import { useState, useCallback, useRef, useMemo } from "react";
import { resolveCountryCode } from "@/lib/countries";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload, Camera, Handshake, Search, Loader2, ImagePlus, Building2, User, MapPin, Calendar,
  FileSpreadsheet, FileText, CheckCircle2, Mail, Phone, Eye, LayoutGrid, LayoutList, Rows3,
  Globe, Sparkles, MessageCircle, Send, X, ClipboardList, Briefcase, ArrowRight, Trash2,
} from "lucide-react";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import { ContactActionMenu } from "@/components/cockpit/ContactActionMenu";
import { adaptBusinessCard } from "@/lib/contactActionAdapter";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { useBusinessCards, useCreateBusinessCard, useUpdateBusinessCard, type BusinessCard, type BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseBusinessCardFile, isImageFile, isDataFile, type ParsedBusinessCard } from "@/lib/businessCardFileParser";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";

/* ═══ Types ═══ */
type ViewMode = "compact" | "card" | "expanded";

/* ═══ Upload + Parse logic ═══ */

function useUploadAndParse() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const createCard = useCreateBusinessCard();

  const uploadImage = useCallback(async (
    file: File, userId: string,
    eventMeta: { event_name?: string; met_at?: string; location?: string },
  ): Promise<boolean> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `business-cards/${userId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("import-files").upload(path, file, { contentType: file.type });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from("import-files").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;
    const parseResult = await invokeEdge<{ error?: string; data?: any }>("parse-business-card", { body: { imageUrl: photoUrl }, context: "BusinessCardsHub.parse_business_card" });
    if (parseResult?.error) throw new Error(parseResult.error);
    const extracted = parseResult?.data || {};
    await createCard.mutateAsync({
      user_id: userId, company_name: extracted.company_name, contact_name: extracted.contact_name,
      email: extracted.email, phone: extracted.phone, mobile: extracted.mobile, position: extracted.position,
      photo_url: photoUrl, event_name: eventMeta.event_name || null, met_at: eventMeta.met_at || null,
      location: eventMeta.location || null, notes: extracted.notes, raw_data: extracted,
    } as any);
    return true;
  }, [createCard]);

  const uploadDataFile = useCallback(async (
    file: File, userId: string,
    eventMeta: { event_name?: string; met_at?: string; location?: string },
  ): Promise<number> => {
    const parsed = await parseBusinessCardFile(file);
    if (parsed.length === 0) throw new Error("Nessun contatto trovato nel file.");
    let created = 0;
    for (const card of parsed) {
      await createCard.mutateAsync({
        user_id: userId, company_name: card.company_name || null, contact_name: card.contact_name || null,
        email: card.email || null, phone: card.phone || null, mobile: card.mobile || null,
        position: card.position || null, notes: card.notes || null, event_name: eventMeta.event_name || null,
        met_at: eventMeta.met_at || null, location: eventMeta.location || null, raw_data: card.raw_data || null,
      } as any);
      created++;
    }
    return created;
  }, [createCard]);

  const processFiles = useCallback(async (
    files: File[], eventMeta: { event_name?: string; met_at?: string; location?: string },
  ) => {
    setUploading(true);
    setProgress({ current: 0, total: files.length });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      let imageCount = 0, dataCount = 0, errors = 0;
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const file = files[i];
        try {
          if (isImageFile(file)) { await uploadImage(file, user.id, eventMeta); imageCount++; }
          else if (isDataFile(file)) { const count = await uploadDataFile(file, user.id, eventMeta); dataCount += count; }
          else { toast({ title: "File ignorato", description: `${file.name} — formato non supportato`, variant: "destructive" }); errors++; }
        } catch (e: any) { toast({ title: `Errore: ${file.name}`, description: e.message, variant: "destructive" }); errors++; }
      }
      const parts: string[] = [];
      if (imageCount > 0) parts.push(`${imageCount} foto analizzate con AI`);
      if (dataCount > 0) parts.push(`${dataCount} contatti importati da file`);
      if (errors > 0) parts.push(`${errors} errori`);
      toast({ title: "✨ Importazione completata", description: parts.join(" · ") || "Nessun contatto elaborato" });
    } catch (e: any) { toast({ title: "Errore", description: e.message, variant: "destructive" }); }
    finally { setUploading(false); setProgress({ current: 0, total: 0 }); }
  }, [uploadImage, uploadDataFile]);

  return { processFiles, uploading, progress };
}

/* ═══ Drop Zone ═══ */
const ACCEPTED_TYPES = "image/*,.csv,.xlsx,.xls,.json,.vcf,.txt";

function DropZone({ onFiles, uploading, progress }: {
  onFiles: (files: File[]) => void; uploading: boolean; progress: { current: number; total: number };
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => isImageFile(f) || isDataFile(f));
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        "relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all",
        dragOver ? "border-violet-400 bg-violet-500/10" : "border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 hover:border-violet-500/30",
        uploading && "opacity-60 pointer-events-none",
      )}
    >
      {uploading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          {progress.total > 0 && <p className="text-xs text-muted-foreground">{progress.current}/{progress.total}</p>}
        </div>
      ) : (
        <>
          <Camera className="w-4 h-4 text-violet-400" />
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-muted-foreground">Trascina foto o file dati</span>
        </>
      )}
      <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden"
        onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) onFiles(files); e.target.value = ""; }} />
    </div>
  );
}

/* ═══ Google Logo Search ═══ */
function googleLogoSearchUrl(companyName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(companyName + " logo")}&tbm=isch`;
}

/* ═══ Country flag ═══ */
function countryFlag(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map((c: string) => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch { return ""; }
}

/* ═══ Resolve country from card data (partner → raw_data → location) ═══ */
function getCardCountryCode(card: BusinessCardWithPartner): string | null {
  if (card.partner?.country_code) return card.partner.country_code;
  const rd = card.raw_data as any;
  if (rd?.country_code) return rd.country_code;
  if (rd?.country) {
    const resolved = resolveCountryCode(rd.country);
    if (resolved) return resolved;
  }
  if (card.location) {
    const resolved = resolveCountryCode(card.location);
    if (resolved) return resolved;
    const parts = card.location.split(",").map(s => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const r = resolveCountryCode(parts[i]);
      if (r) return r;
    }
  }
  return null;
}

/* ═══ Status badge ═══ */
const STATUS_COLORS: Record<string, string> = {
  matched: "bg-emerald-500/15 text-emerald-400",
  unmatched: "bg-amber-500/15 text-amber-400",
  pending: "bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<string, string> = {
  matched: "Match", unmatched: "No match", pending: "Attesa",
};

/* ═══ Origin accent border ═══ */
function getCardOriginClasses(card: BusinessCardWithPartner): { border: string; bg: string } {
  if (card.match_status === "matched" && card.matched_partner_id) {
    return { border: "from-chart-1/60 to-chart-1/20", bg: "bg-chart-1/5" };
  }
  return { border: "from-amber-500/60 to-amber-500/20", bg: "bg-amber-500/5" };
}

/* ═══ Get WCA membership year ═══ */
function getWcaYear(card: BusinessCardWithPartner): string | null {
  if (!card.partner) return null;
  const ed = card.partner.enrichment_data;
  if (!ed) return null;
  const year = ed?.membership_year || ed?.member_since || ed?.wca_year;
  return year ? String(year) : null;
}

/* ═══ BCA Quick Actions (⋮) ═══ */
function BCAQuickActions({ card }: { card: BusinessCardWithPartner }) {
  const navigate = useNavigate();
  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!card.email) return;
    navigate("/email-composer", {
      state: {
        prefilledRecipient: {
          email: card.email,
          name: card.contact_name || undefined,
          company: card.company_name || undefined,
          partnerId: card.matched_partner_id || undefined,
        },
      },
    });
  };
  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (card.mobile || card.phone || "").replace(/[^0-9+]/g, "");
    if (phone) window.open(`https://wa.me/${phone.replace("+", "")}`, "_blank");
  };
    return (
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        {card.email && (
          <button onClick={handleEmail} className="p-0.5 rounded hover:bg-primary/10" title="Email">
            <Mail className="w-3 h-3 text-primary" />
          </button>
        )}
        {(card.phone || card.mobile) && (
          <button onClick={handleWhatsApp} className="p-0.5 rounded hover:bg-emerald-500/10" title="WhatsApp">
            <MessageCircle className="w-3 h-3 text-emerald-500" />
          </button>
        )}
        <ContactActionMenu contact={adaptBusinessCard(card)} />
      </div>
    );
}

/* ═══ Compact List Row — 2 righe ═══ */
function CompactRow({ card, isSelected, onSelect, onShowDetail, onGoogleLogo }: {
  card: BusinessCardWithPartner; isSelected: boolean; onSelect: () => void; onShowDetail: () => void; onGoogleLogo: () => void;
}) {
  const sc = STATUS_COLORS[card.match_status] || STATUS_COLORS.pending;
  const accent = getCardOriginClasses(card);
  const cardCountry = getCardCountryCode(card);
  const flag = cardCountry ? countryFlag(cardCountry) : "";
  const wcaYear = getWcaYear(card);
  const city = card.partner?.enrichment_data?.city || card.location || "";

  return (
    <div className={cn(
      "relative flex flex-col gap-0.5 px-3 py-2 rounded-lg transition-colors hover:bg-muted/40 border border-transparent overflow-hidden cursor-pointer group/row",
      isSelected && "bg-primary/10 border-primary/20",
    )} onClick={onShowDetail}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l", accent.border)} />
      
      {/* Row 1: Checkbox, Flag, Company, Status, Icons, Quick Actions */}
      <div className="flex items-center gap-2 min-w-0">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-3.5 w-3.5 shrink-0" onClick={(e) => e.stopPropagation()} />
        {flag && <span className="text-sm shrink-0">{flag}</span>}
        <span className="text-sm font-semibold text-foreground truncate flex-1">{card.company_name || "—"}</span>
        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0", sc)}>
          {STATUS_LABELS[card.match_status] || "Attesa"}
        </span>
        {card.email && <Mail className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
        {(card.phone || card.mobile) && <Phone className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
        <BCAQuickActions card={card} />
      </div>

      {/* Row 2: Contact name, Position, City, Event, WCA year */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-8 min-w-0">
        {card.contact_name && (
          <span className="flex items-center gap-1 shrink-0">
            <User className="w-3 h-3" />{card.contact_name}
          </span>
        )}
        {card.position && <span className="truncate max-w-[120px]">{card.position}</span>}
        {city && (
          <span className="flex items-center gap-0.5 shrink-0">
            <MapPin className="w-2.5 h-2.5" />{city}
          </span>
        )}
        {card.event_name && (
          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
            <Handshake className="w-2.5 h-2.5 text-violet-400" />{card.event_name}
          </span>
        )}
        {wcaYear && (
          <Badge variant="outline" className="text-[8px] h-4 px-1 border-chart-1/20 text-chart-1 shrink-0">
            WCA {wcaYear}
          </Badge>
        )}
      </div>
    </div>
  );
}

/* ═══ Card Grid Item ═══ */
function CardGridItem({ card, isSelected, onSelect, onShowDetail, onGoogleLogo }: {
  card: BusinessCardWithPartner; isSelected: boolean; onSelect: () => void; onShowDetail: () => void; onGoogleLogo: () => void;
}) {
  const sc = STATUS_COLORS[card.match_status] || STATUS_COLORS.pending;
  const hasPhoto = !!card.photo_url;
  const accent = getCardOriginClasses(card);
  const cardCountry = getCardCountryCode(card);
  const flag = cardCountry ? countryFlag(cardCountry) : "";
  const wcaYear = getWcaYear(card);

  return (
    <div className={cn(
      "relative bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 border rounded-xl overflow-hidden transition-all cursor-pointer",
      isSelected ? "border-primary/40 shadow-sm" : "border-violet-500/10 hover:border-violet-500/20",
    )} onClick={onShowDetail}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l z-10", accent.border)} />
      {hasPhoto ? (
        <AspectRatio ratio={16 / 9}>
          <img src={card.photo_url!} alt="BCA" className="w-full h-full object-cover" loading="lazy" />
        </AspectRatio>
      ) : (
        <div className="h-8 bg-gradient-to-r from-emerald-500/10 to-violet-500/10 flex items-center justify-center gap-1">
          <FileText className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] text-emerald-400 font-medium">Da file</span>
        </div>
      )}
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-3.5 w-3.5 mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1">
              {flag && <span className="text-xs">{flag}</span>}
              {card.company_name || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {card.contact_name || "—"}{card.position ? ` · ${card.position}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge className={cn("text-[8px] px-1 py-0", sc)}>{STATUS_LABELS[card.match_status] || "Attesa"}</Badge>
          {wcaYear && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-chart-1/20 text-chart-1">WCA {wcaYear}</Badge>
          )}
          {card.email && <Mail className="w-3 h-3 text-muted-foreground/40" />}
          {(card.phone || card.mobile) && <Phone className="w-3 h-3 text-muted-foreground/40" />}
        </div>
      </div>
    </div>
  );
}

/* ═══ Expanded Card ═══ */
function ExpandedCardItem({ card, isSelected, onSelect, onShowDetail, onGoogleLogo }: {
  card: BusinessCardWithPartner; isSelected: boolean; onSelect: () => void; onShowDetail: () => void; onGoogleLogo: () => void;
}) {
  const sc = STATUS_COLORS[card.match_status] || STATUS_COLORS.pending;
  const hasPhoto = !!card.photo_url;
  const accent = getCardOriginClasses(card);
  const cardCountry = getCardCountryCode(card);
  const flag = cardCountry ? countryFlag(cardCountry) : "";
  const wcaYear = getWcaYear(card);

  return (
    <div className={cn(
      "relative bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 border rounded-xl overflow-hidden transition-all cursor-pointer",
      isSelected ? "border-primary/40 shadow-sm" : "border-violet-500/10 hover:border-violet-500/20",
    )} onClick={onShowDetail}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l z-10", accent.border)} />
      <div className="flex gap-3 p-3">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} className="h-3.5 w-3.5 mt-1 shrink-0" onClick={(e) => e.stopPropagation()} />
        {hasPhoto && (
          <div className="w-28 shrink-0 rounded-lg overflow-hidden border border-border/30">
            <AspectRatio ratio={16 / 9}>
              <img src={card.photo_url!} alt="BCA" className="w-full h-full object-cover" loading="lazy" />
            </AspectRatio>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold truncate flex items-center gap-1.5">
            {flag && <span>{flag}</span>}
            {card.company_name || "—"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {card.contact_name || "—"}{card.position ? ` · ${card.position}` : ""}
          </p>
          {card.event_name && (
            <div className="flex items-center gap-1">
              <Handshake className="w-3 h-3 text-violet-400 shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{card.event_name}</span>
              {card.met_at && <span className="text-[10px] text-muted-foreground/60">{format(new Date(card.met_at), "dd MMM yy", { locale: it })}</span>}
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <Badge className={cn("text-[8px] px-1 py-0", sc)}>{STATUS_LABELS[card.match_status] || "Attesa"}</Badge>
            {wcaYear && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 border-chart-1/20 text-chart-1">WCA {wcaYear}</Badge>
            )}
            {card.email && <Mail className="w-3 h-3 text-muted-foreground/40" />}
            {(card.phone || card.mobile) && <Phone className="w-3 h-3 text-muted-foreground/40" />}
            {card.partner && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/20 text-emerald-400">
                <Building2 className="w-2.5 h-2.5 mr-0.5" />{card.partner.company_name}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Bulk Action Bar for BCA ═══ */
function BCABulkActionBar({ count, cards, selectedIds, onClear, onEmail, onWhatsApp, onCockpit, onWorkspace, onDelete }: {
  count: number;
  cards: BusinessCardWithPartner[];
  selectedIds: Set<string>;
  onClear: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  onCockpit: () => void;
  onWorkspace: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  const selectedCards = cards.filter(c => selectedIds.has(c.id));
  const withEmail = selectedCards.filter(c => c.email).length;
  const withPhone = selectedCards.filter(c => c.phone || c.mobile).length;

  return (
    <div className="px-3 py-1.5 border-b border-violet-500/15 bg-violet-500/[0.06] backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-violet-300">{count} sel.</span>

        {withEmail > 0 && (
          <Button size="sm" variant="ghost" onClick={onEmail}
            className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100">
            <Mail className="w-3 h-3" /> Email ({withEmail})
          </Button>
        )}

        {withPhone > 0 && (
          <Button size="sm" variant="ghost" onClick={onWhatsApp}
            className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100">
            <MessageCircle className="w-3 h-3" /> WhatsApp ({withPhone})
          </Button>
        )}

        <Button size="sm" variant="ghost" onClick={onWorkspace}
          className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100">
          <ClipboardList className="w-3 h-3" /> Workspace
        </Button>

        <Button size="sm" variant="ghost" onClick={onCockpit}
          className="h-6 px-2 text-[11px] gap-1 text-violet-200 hover:bg-violet-500/15 hover:text-violet-100">
          <ArrowRight className="w-3 h-3" /> Cockpit
        </Button>

        <Button size="sm" variant="ghost" onClick={onDelete}
          className="h-6 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/15">
          <Trash2 className="w-3 h-3" /> Elimina
        </Button>

        <button onClick={onClear} className="ml-auto hover:bg-violet-500/20 rounded-full p-0.5 transition-colors text-violet-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ═══ Detail Side Panel ═══ */
function BusinessCardDetailPanel({ card, onClose }: { card: BusinessCardWithPartner; onClose: () => void }) {
  const navigate = useNavigate();
  const { handleSendEmail, handleSendWhatsApp, waSending, waAvailable } = useDirectContactActions();
  const waPhone = card.mobile || card.phone;

  const handleCockpit = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("cockpit_queue").insert({
        source_id: card.id,
        source_type: "business_card",
        user_id: user.id,
        partner_id: card.matched_partner_id || null,
      } as any);
      toast({ title: "✅ Aggiunto al Cockpit" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }, [card]);

  const handleWorkspace = useCallback(() => {
    if (!card.email) {
      toast({ title: "Email mancante", variant: "destructive" });
      return;
    }
    navigate("/email-composer", {
      state: {
        prefilledRecipient: {
          email: card.email,
          name: card.contact_name || undefined,
          company: card.company_name || undefined,
          partnerId: card.matched_partner_id || undefined,
        },
      },
    });
  }, [card, navigate]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/15 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-violet-400" />
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

      {/* Photo */}
      {card.photo_url && (
        <div className="rounded-lg overflow-hidden border border-border/30">
          <img src={card.photo_url} alt="Biglietto" className="w-full object-contain" loading="lazy" />
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
          <Send className="w-3 h-3" /> Azioni rapide
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {card.email && (
            <Button
              variant="outline" size="sm"
              className="h-8 text-xs gap-1.5 border-violet-500/15 hover:bg-violet-500/10 justify-start"
              onClick={() => handleSendEmail({ email: card.email!, name: card.contact_name || undefined, company: card.company_name || undefined, partnerId: card.partner?.id })}
            >
              <Mail className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="truncate">Email</span>
            </Button>
          )}
          {waPhone && (
            <Button
              variant="outline" size="sm"
              className="h-8 text-xs gap-1.5 border-emerald-500/15 hover:bg-emerald-500/10 justify-start"
              disabled={waSending === card.id || !waAvailable}
              onClick={() => handleSendWhatsApp({
                phone: waPhone, contactName: card.contact_name || undefined, companyName: card.company_name || undefined,
                sourceType: "contact", sourceId: card.id, partnerId: card.partner?.id || undefined,
              })}
            >
              {waSending === card.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              <span className="truncate">WhatsApp</span>
            </Button>
          )}
          {(card.phone || card.mobile) && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-violet-500/15 hover:bg-violet-500/10 justify-start" asChild>
              <a href={`tel:${card.phone || card.mobile}`}>
                <Phone className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="truncate">Chiama</span>
              </a>
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className="h-8 text-xs gap-1.5 border-violet-500/15 hover:bg-violet-500/10 justify-start"
            onClick={handleCockpit}
          >
            <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">→ Cockpit</span>
          </Button>
          {card.email && (
            <Button
              variant="outline" size="sm"
              className="h-8 text-xs gap-1.5 border-violet-500/15 hover:bg-violet-500/10 justify-start"
              onClick={handleWorkspace}
            >
              <Briefcase className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="truncate">Workspace</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5 bg-muted/20 rounded-lg p-3 border border-border/30">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Dettagli contatto</p>
        {card.email && (
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Mail className="w-3.5 h-3.5 text-violet-400 shrink-0" /> <span className="truncate">{card.email}</span>
          </div>
        )}
        {card.phone && (
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Phone className="w-3.5 h-3.5 text-violet-400 shrink-0" /> {card.phone}
          </div>
        )}
        {card.mobile && card.mobile !== card.phone && (
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {card.mobile}
          </div>
        )}
      </div>

      {/* Event */}
      {card.event_name && (
        <div className="space-y-1 bg-violet-500/5 rounded-lg p-3 border border-violet-500/10">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Evento</p>
          <div className="flex items-center gap-1.5">
            <Handshake className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-foreground">{card.event_name}</span>
          </div>
          {card.met_at && <p className="text-[10px] text-muted-foreground ml-5">{format(new Date(card.met_at), "dd MMMM yyyy", { locale: it })}</p>}
          {card.location && <p className="text-[10px] text-muted-foreground ml-5">{card.location}</p>}
        </div>
      )}

      {/* Status */}
      <div className="space-y-2 bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 rounded-lg p-3 border border-violet-500/10">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Stato</p>
        <Badge className={cn("text-[10px]", STATUS_COLORS[card.match_status] || STATUS_COLORS.pending)}>
          {STATUS_LABELS[card.match_status] || "In attesa"}
        </Badge>
        {card.match_confidence > 0 && (
          <p className="text-[10px] text-muted-foreground">Confidenza match: {Math.round(card.match_confidence * 100)}%</p>
        )}
      </div>

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.map((t) => <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>)}
        </div>
      )}

      {/* Notes */}
      {card.notes && (
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border/30">
          {card.notes}
        </div>
      )}

      {/* Google logo search */}
      {card.company_name && (
        <Button
          variant="outline" size="sm" className="w-full text-xs gap-2 border-violet-500/15 hover:bg-violet-500/10"
          onClick={() => window.open(googleLogoSearchUrl(card.company_name!), "_blank")}
        >
          <Globe className="w-3.5 h-3.5 text-violet-400" /> Cerca logo su Google
        </Button>
      )}

      {/* Manual partner matching for unmatched cards */}
      {card.match_status !== "matched" && <ManualPartnerMatcher card={card} />}
    </div>
  );
}

/* ═══ Manual Partner Matcher ═══ */
function ManualPartnerMatcher({ card }: { card: BusinessCardWithPartner }) {
  const [searchTerm, setSearchTerm] = useState(card.company_name || "");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const updateCard = useUpdateBusinessCard();

  const doSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, company_alias, country_code, country_name, city")
        .or(`company_name.ilike.%${searchTerm.trim()}%,company_alias.ilike.%${searchTerm.trim()}%`)
        .order("country_name")
        .order("city")
        .order("company_name")
        .limit(20);
      if (error) throw error;
      setResults(data ?? []);
    } catch (e: any) {
      toast({ title: "Errore ricerca", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [searchTerm]);

  const confirmMatch = useCallback(async (partnerId: string) => {
    try {
      await updateCard.mutateAsync({ id: card.id, matched_partner_id: partnerId, match_status: "matched", match_confidence: 100 } as any);
      toast({ title: "✅ Match confermato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }, [card.id, updateCard]);

  return (
    <div className="space-y-2 bg-amber-500/5 rounded-lg p-3 border border-amber-500/15">
      <p className="text-[10px] text-amber-400 uppercase tracking-wider font-medium flex items-center gap-1">
        <Search className="w-3 h-3" /> Cerca partner WCA
      </p>
      <div className="flex gap-1.5">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Nome azienda..."
          className="h-7 text-xs flex-1"
        />
        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0" onClick={doSearch} disabled={searching}>
          {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        </Button>
      </div>
      {searched && results.length === 0 && !searching && (
        <p className="text-[10px] text-muted-foreground">Nessun partner trovato</p>
      )}
      {results.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group"
              onClick={() => confirmMatch(p.id)}
            >
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

/* ═══ Main Hub ═══ */

export default function BusinessCardsHub() {
  const navigate = useNavigate();
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCard, setDetailCard] = useState<BusinessCardWithPartner | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [eventName, setEventName] = useState("");
  const [metAt, setMetAt] = useState("");
  const [location, setLocation] = useState("");

  const { handleSendEmail, handleSendWhatsApp, waAvailable } = useDirectContactActions();
  const { processFiles, uploading, progress } = useUploadAndParse();
  const { data: cards = [], isLoading, refetch } = useBusinessCards({
    event_name: eventFilter || undefined,
    match_status: statusFilter || undefined,
  });

  const eventNames = [...new Set(cards.map((c) => c.event_name).filter(Boolean))] as string[];
  const pendingImages = pendingFiles.filter(isImageFile).length;
  const pendingData = pendingFiles.filter(isDataFile).length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleFiles = useCallback((files: File[]) => { setPendingFiles(files); setShowEventDialog(true); }, []);
  const handleConfirmUpload = useCallback(async () => {
    setShowEventDialog(false);
    const meta = { event_name: eventName || undefined, met_at: metAt || undefined, location: location || undefined };
    await processFiles(pendingFiles, meta);
    setPendingFiles([]);
  }, [pendingFiles, eventName, metAt, location, processFiles]);

  const handleGoogleLogo = useCallback((companyName: string | null) => {
    if (companyName) window.open(googleLogoSearchUrl(companyName), "_blank");
  }, []);

  // Bulk actions
  const handleBulkEmail = useCallback(() => {
    const selected = cards.filter(c => selectedIds.has(c.id) && c.email);
    if (selected.length === 0) { toast({ title: "Nessun contatto con email" }); return; }
    if (selected.length === 1) {
      handleSendEmail({ email: selected[0].email!, name: selected[0].contact_name || undefined, company: selected[0].company_name || undefined });
    } else {
      navigate("/email-composer", {
        state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) },
      });
    }
  }, [cards, selectedIds, handleSendEmail, navigate]);

  const handleBulkWhatsApp = useCallback(() => {
    const selected = cards.filter(c => selectedIds.has(c.id) && (c.phone || c.mobile));
    if (selected.length === 0) { toast({ title: "Nessun contatto con telefono" }); return; }
    const first = selected[0];
    handleSendWhatsApp({
      phone: (first.mobile || first.phone)!,
      contactName: first.contact_name || undefined,
      companyName: first.company_name || undefined,
      sourceType: "contact",
      sourceId: first.id,
    });
  }, [cards, selectedIds, handleSendWhatsApp]);

  const handleBulkCockpit = useCallback(async () => {
    const selected = cards.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const inserts = selected.map(c => ({
        source_id: c.id,
        source_type: "business_card",
        user_id: user.id,
        partner_id: c.matched_partner_id || null,
      }));
      await supabase.from("cockpit_queue").insert(inserts as any);
      toast({ title: `✅ ${selected.length} aggiunti al Cockpit` });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }, [cards, selectedIds]);

  const handleBulkWorkspace = useCallback(() => {
    const selected = cards.filter(c => selectedIds.has(c.id) && c.email);
    if (selected.length === 0) { toast({ title: "Nessun contatto con email" }); return; }
    navigate("/email-composer", {
      state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) },
    });
  }, [cards, selectedIds, navigate]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Eliminare ${ids.length} biglietti da visita?`)) return;
    const { error } = await supabase.from("business_cards").delete().in("id", ids);
    if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
    toast({ title: `✅ ${ids.length} biglietti eliminati` });
    setSelectedIds(new Set());
    refetch();
  }, [selectedIds, refetch]);

  const showPanel = !!detailCard;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Bulk action bar */}
      <UnifiedBulkActionBar
        count={selectedIds.size}
        sourceType="business_card"
        onClear={() => setSelectedIds(new Set())}
        onEmail={handleBulkEmail}
        onWhatsApp={handleBulkWhatsApp}
        onCockpit={handleBulkCockpit}
        onWorkspace={handleBulkWorkspace}
        onDelete={handleBulkDelete}
        onDeepSearch={() => {
          const partnerIds = new Set<string>();
          for (const id of selectedIds) {
            const card = cards.find(c => c.id === id);
            if (card?.matched_partner_id) partnerIds.add(card.matched_partner_id);
          }
          if (partnerIds.size === 0) { toast({ title: "Nessun biglietto associato a un partner" }); return; }
          invokeEdge("deep-search-partner", {
            body: { partnerIds: Array.from(partnerIds) },
            context: "BusinessCardsHub.deep_search_partner",
          })
            .then(() => toast({ title: `✅ Deep Search avviata su ${partnerIds.size} partner` }))
            .catch(() => toast({ title: "Errore Deep Search", variant: "destructive" }));
        }}
        onGoogleLogo={() => {
          const selected = cards.filter(c => selectedIds.has(c.id));
          const first = selected.find(c => c.company_name);
          if (first?.company_name) window.open(googleLogoSearchUrl(first.company_name), "_blank");
        }}
        onLinkedIn={() => {
          const selected = cards.filter(c => selectedIds.has(c.id));
          const names = selected.map(c => ({ name: c.contact_name || "", company: c.company_name || "" })).filter(n => n.name);
          if (names.length === 0) { toast({ title: "Nessun contatto con nome" }); return; }
          const query = `${names[0].name} ${names[0].company} LinkedIn`;
          window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
        }}
        onCampaign={() => {
          const selected = cards.filter(c => selectedIds.has(c.id) && c.email);
          if (selected.length === 0) { toast({ title: "Nessun contatto con email" }); return; }
          navigate("/email-composer", {
            state: { partnerIds: selected.filter(c => c.matched_partner_id).map(c => c.matched_partner_id) },
          });
        }}
        withEmail={cards.filter(c => selectedIds.has(c.id) && c.email).length}
        withPhone={cards.filter(c => selectedIds.has(c.id) && (c.phone || c.mobile)).length}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content */}
        <div className={cn("flex-1 min-w-0 overflow-y-auto p-3 space-y-3", showPanel && "border-r border-border/50")}>
          <DropZone onFiles={handleFiles} uploading={uploading} progress={progress} />

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue placeholder="Tutti" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="matched">Matchati</SelectItem>
                <SelectItem value="unmatched">No match</SelectItem>
                <SelectItem value="pending">Attesa</SelectItem>
              </SelectContent>
            </Select>

            {eventNames.length > 0 && (
              <Select value={eventFilter} onValueChange={(v) => setEventFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-7 w-[140px] text-[11px]"><SelectValue placeholder="Tutti eventi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {eventNames.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={cards.length > 0 && selectedIds.size === cards.length}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedIds(new Set(cards.map(c => c.id)));
                  else setSelectedIds(new Set());
                }}
                aria-label="Seleziona tutti"
                className="shrink-0"
              />
              <span className="text-[10px] text-muted-foreground">Tutti</span>
            </div>
            <Badge variant="outline" className="text-[10px] h-7 px-2 border-violet-500/15">{cards.length} biglietti</Badge>

            <div className="ml-auto flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5">
              {([
                { mode: "compact" as ViewMode, icon: LayoutList, label: "Lista" },
                { mode: "card" as ViewMode, icon: LayoutGrid, label: "Card" },
                { mode: "expanded" as ViewMode, icon: Rows3, label: "Espanso" },
              ]).map(({ mode, icon: Icon, label }) => (
                <TooltipProvider key={mode}>
                  <Tooltip><TooltipTrigger asChild>
                    <button
                      className={cn("p-1.5 rounded transition-colors", viewMode === mode ? "bg-background shadow-sm" : "hover:bg-muted/60")}
                      onClick={() => setViewMode(mode)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger><TooltipContent side="bottom" className="text-xs">{label}</TooltipContent></Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* Cards */}
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-400 animate-spin" /></div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                <ImagePlus className="w-8 h-8 text-violet-400/50" />
              </div>
              <p className="text-sm text-muted-foreground">Nessun biglietto da visita</p>
            </div>
          ) : viewMode === "compact" ? (
            <div className="space-y-0.5">
              {cards.map((card) => (
                <CompactRow key={card.id} card={card} isSelected={selectedIds.has(card.id)}
                  onSelect={() => toggleSelect(card.id)} onShowDetail={() => setDetailCard(card)}
                  onGoogleLogo={() => handleGoogleLogo(card.company_name)} />
              ))}
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cards.map((card) => (
                <CardGridItem key={card.id} card={card} isSelected={selectedIds.has(card.id)}
                  onSelect={() => toggleSelect(card.id)} onShowDetail={() => setDetailCard(card)}
                  onGoogleLogo={() => handleGoogleLogo(card.company_name)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map((card) => (
                <ExpandedCardItem key={card.id} card={card} isSelected={selectedIds.has(card.id)}
                  onSelect={() => toggleSelect(card.id)} onShowDetail={() => setDetailCard(card)}
                  onGoogleLogo={() => handleGoogleLogo(card.company_name)} />
              ))}
            </div>
          )}
        </div>

        {/* Right detail panel */}
        {showPanel && detailCard && (
          <div className="w-[320px] shrink-0 bg-card/50 backdrop-blur-sm flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Dettaglio</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setDetailCard(null)}>✕</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <BusinessCardDetailPanel card={detailCard} onClose={() => setDetailCard(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Event dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-sm bg-card border-violet-500/20">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Handshake className="w-4 h-4 text-violet-400" /> Dettagli incontro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {pendingImages > 0 && <Badge variant="outline" className="text-[10px] border-violet-500/20">📸 {pendingImages} foto</Badge>}
              {pendingData > 0 && <Badge variant="outline" className="text-[10px] border-emerald-500/20">📄 {pendingData} file</Badge>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Evento / Fiera</label>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="es. Cosmoprof 2026" className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data incontro</label>
              <Input type="date" value={metAt} onChange={(e) => setMetAt(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Luogo</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="es. Bologna Fiere" className="h-8 text-xs mt-1" />
            </div>
            <p className="text-[10px] text-muted-foreground/60">Opzionale — puoi saltare</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setEventName(""); setMetAt(""); setLocation(""); handleConfirmUpload(); }}>Salta</Button>
            <Button size="sm" className="text-xs" onClick={handleConfirmUpload}>
              {pendingImages > 0 && pendingData > 0 ? "Carica tutto" : pendingImages > 0 ? "Carica e analizza" : "Importa contatti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
