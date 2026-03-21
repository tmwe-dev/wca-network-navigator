import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Upload, Camera, Handshake, Search, Loader2, ImagePlus, Building2, User, MapPin, Calendar,
} from "lucide-react";
import { useBusinessCards, useCreateBusinessCard, useUpdateBusinessCard, type BusinessCard } from "@/hooks/useBusinessCards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ═══ Upload + Parse logic ═══ */

function useUploadAndParse() {
  const [uploading, setUploading] = useState(false);
  const createCard = useCreateBusinessCard();

  const uploadAndParse = useCallback(async (
    file: File,
    eventMeta: { event_name?: string; met_at?: string; location?: string },
  ) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Upload to storage
      const ext = file.name.split(".").pop() || "jpg";
      const path = `business-cards/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("import-files")
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: urlData } = supabase.storage.from("import-files").getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      // Call AI parsing
      const { data: parseResult, error: parseErr } = await supabase.functions.invoke("parse-business-card", {
        body: { imageUrl: photoUrl },
      });
      if (parseErr) throw parseErr;
      if (parseResult?.error) throw new Error(parseResult.error);

      const extracted = parseResult?.data || {};

      // Create business card record
      await createCard.mutateAsync({
        user_id: user.id,
        company_name: extracted.company_name,
        contact_name: extracted.contact_name,
        email: extracted.email,
        phone: extracted.phone,
        mobile: extracted.mobile,
        position: extracted.position,
        photo_url: photoUrl,
        event_name: eventMeta.event_name || null,
        met_at: eventMeta.met_at || null,
        location: eventMeta.location || null,
        notes: extracted.notes,
        raw_data: extracted,
      } as any);

      toast({
        title: "✨ Biglietto analizzato",
        description: `${extracted.contact_name || "Contatto"} — ${extracted.company_name || "Azienda"}`,
      });

      return true;
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setUploading(false);
    }
  }, [createCard]);

  return { uploadAndParse, uploading };
}

/* ═══ Drop Zone ═══ */

function DropZone({ onFiles, uploading }: { onFiles: (files: File[]) => void; uploading: boolean }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/") || f.name.match(/\.(jpg|jpeg|png|heic|webp)$/i)
    );
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
        dragOver
          ? "border-violet-400 bg-violet-500/10"
          : "border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 hover:border-violet-500/30",
        uploading && "opacity-60 pointer-events-none",
      )}
    >
      {uploading ? (
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <Camera className="w-6 h-6 text-violet-400" />
        </div>
      )}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {uploading ? "Analisi in corso..." : "Trascina qui le foto dei biglietti"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, HEIC — l'AI estrae automaticamente i dati
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ═══ Card Item ═══ */

function BusinessCardItem({ card }: { card: BusinessCard }) {
  const statusColors: Record<string, string> = {
    matched: "bg-emerald-500/15 text-emerald-400 border-0",
    unmatched: "bg-amber-500/15 text-amber-400 border-0",
    pending: "bg-muted text-muted-foreground border-0",
  };

  return (
    <div className="bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 backdrop-blur-sm border border-violet-500/10 rounded-2xl overflow-hidden">
      {/* Photo thumbnail */}
      {card.photo_url && (
        <AspectRatio ratio={16 / 9}>
          <img
            src={card.photo_url}
            alt="Biglietto da visita"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </AspectRatio>
      )}

      <div className="p-3 space-y-2">
        {/* Name + company */}
        <div>
          {card.contact_name && (
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-violet-400 shrink-0" />
              <p className="text-sm font-medium truncate">{card.contact_name}</p>
            </div>
          )}
          {card.company_name && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{card.company_name}</p>
            </div>
          )}
          {card.position && (
            <p className="text-[10px] text-muted-foreground/70 ml-[18px]">{card.position}</p>
          )}
        </div>

        {/* Event info */}
        {card.event_name && (
          <div className="flex items-center gap-1.5">
            <Handshake className="w-3 h-3 text-violet-400 shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate">{card.event_name}</span>
            {card.met_at && (
              <span className="text-[10px] text-muted-foreground/60">
                {format(new Date(card.met_at), "dd MMM yyyy", { locale: it })}
              </span>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          <Badge className={cn("text-[9px]", statusColors[card.match_status] || statusColors.pending)}>
            {card.match_status === "matched" ? "Matchato" : card.match_status === "unmatched" ? "Non trovato" : "In attesa"}
          </Badge>
          {card.email && (
            <Badge variant="outline" className="text-[9px] border-violet-500/15">{card.email}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Main Hub ═══ */

export default function BusinessCardsHub() {
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [eventName, setEventName] = useState("");
  const [metAt, setMetAt] = useState("");
  const [location, setLocation] = useState("");

  const { uploadAndParse, uploading } = useUploadAndParse();
  const { data: cards = [], isLoading } = useBusinessCards({
    event_name: eventFilter || undefined,
    match_status: statusFilter || undefined,
  });

  // Get unique event names for filter
  const eventNames = [...new Set(cards.map((c) => c.event_name).filter(Boolean))] as string[];

  const handleFiles = useCallback((files: File[]) => {
    setPendingFiles(files);
    setShowEventDialog(true);
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    setShowEventDialog(false);
    const meta = { event_name: eventName || undefined, met_at: metAt || undefined, location: location || undefined };
    for (const file of pendingFiles) {
      await uploadAndParse(file, meta);
    }
    setPendingFiles([]);
  }, [pendingFiles, eventName, metAt, location, uploadAndParse]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Upload zone */}
      <DropZone onFiles={handleFiles} uploading={uploading} />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="matched">Matchati</SelectItem>
            <SelectItem value="unmatched">Non trovati</SelectItem>
            <SelectItem value="pending">In attesa</SelectItem>
          </SelectContent>
        </Select>

        {eventNames.length > 0 && (
          <Select value={eventFilter} onValueChange={(v) => setEventFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Tutti gli eventi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli eventi</SelectItem>
              {eventNames.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Badge variant="outline" className="text-xs border-violet-500/15 h-8 px-3 flex items-center">
          {cards.length} biglietti
        </Badge>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <ImagePlus className="w-8 h-8 text-violet-400/50" />
          </div>
          <p className="text-sm text-muted-foreground">Nessun biglietto da visita</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Carica una foto per iniziare</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card) => (
            <BusinessCardItem key={card.id} card={card} />
          ))}
        </div>
      )}

      {/* Event metadata dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-sm bg-card border-violet-500/20">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Handshake className="w-4 h-4 text-violet-400" />
              Dettagli incontro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Evento / Fiera</label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="es. Cosmoprof 2026"
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data incontro</label>
              <Input
                type="date"
                value={metAt}
                onChange={(e) => setMetAt(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Luogo</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="es. Bologna Fiere"
                className="h-8 text-xs mt-1"
              />
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {pendingFiles.length} {pendingFiles.length === 1 ? "foto" : "foto"} — opzionale, puoi saltare
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setEventName("");
                setMetAt("");
                setLocation("");
                handleConfirmUpload();
              }}
            >
              Salta
            </Button>
            <Button size="sm" className="text-xs" onClick={handleConfirmUpload}>
              Carica e analizza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
