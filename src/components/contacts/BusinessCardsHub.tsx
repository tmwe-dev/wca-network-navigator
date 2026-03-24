import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Upload, Camera, Handshake, Search, Loader2, ImagePlus, Building2, User, MapPin, Calendar,
  FileSpreadsheet, FileText, CheckCircle2,
} from "lucide-react";
import { useBusinessCards, useCreateBusinessCard, useUpdateBusinessCard, type BusinessCard } from "@/hooks/useBusinessCards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseBusinessCardFile, isImageFile, isDataFile, type ParsedBusinessCard } from "@/lib/businessCardFileParser";

/* ═══ Upload + Parse logic ═══ */

function useUploadAndParse() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const createCard = useCreateBusinessCard();

  /** Upload a single image → AI Vision parse */
  const uploadImage = useCallback(async (
    file: File,
    userId: string,
    eventMeta: { event_name?: string; met_at?: string; location?: string },
  ): Promise<boolean> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `business-cards/${userId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("import-files")
      .upload(path, file, { contentType: file.type });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from("import-files").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    const { data: parseResult, error: parseErr } = await supabase.functions.invoke("parse-business-card", {
      body: { imageUrl: photoUrl },
    });
    if (parseErr) throw parseErr;
    if (parseResult?.error) throw new Error(parseResult.error);

    const extracted = parseResult?.data || {};

    await createCard.mutateAsync({
      user_id: userId,
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

    return true;
  }, [createCard]);

  /** Parse a data file (CSV/XLSX/JSON/VCF) → multiple cards */
  const uploadDataFile = useCallback(async (
    file: File,
    userId: string,
    eventMeta: { event_name?: string; met_at?: string; location?: string },
  ): Promise<number> => {
    const parsed = await parseBusinessCardFile(file);
    if (parsed.length === 0) throw new Error("Nessun contatto trovato nel file.");

    let created = 0;
    for (const card of parsed) {
      await createCard.mutateAsync({
        user_id: userId,
        company_name: card.company_name || null,
        contact_name: card.contact_name || null,
        email: card.email || null,
        phone: card.phone || null,
        mobile: card.mobile || null,
        position: card.position || null,
        notes: card.notes || null,
        event_name: eventMeta.event_name || null,
        met_at: eventMeta.met_at || null,
        location: eventMeta.location || null,
        raw_data: card.raw_data || null,
      } as any);
      created++;
    }

    return created;
  }, [createCard]);

  /** Main entry: handles mixed files */
  const processFiles = useCallback(async (
    files: File[],
    eventMeta: { event_name?: string; met_at?: string; location?: string },
  ) => {
    setUploading(true);
    setProgress({ current: 0, total: files.length });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      let imageCount = 0;
      let dataCount = 0;
      let errors = 0;

      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const file = files[i];

        try {
          if (isImageFile(file)) {
            await uploadImage(file, user.id, eventMeta);
            imageCount++;
          } else if (isDataFile(file)) {
            const count = await uploadDataFile(file, user.id, eventMeta);
            dataCount += count;
          } else {
            toast({ title: "File ignorato", description: `${file.name} — formato non supportato`, variant: "destructive" });
            errors++;
          }
        } catch (e: any) {
          toast({ title: `Errore: ${file.name}`, description: e.message, variant: "destructive" });
          errors++;
        }
      }

      const parts: string[] = [];
      if (imageCount > 0) parts.push(`${imageCount} foto analizzate con AI`);
      if (dataCount > 0) parts.push(`${dataCount} contatti importati da file`);
      if (errors > 0) parts.push(`${errors} errori`);

      toast({
        title: "✨ Importazione completata",
        description: parts.join(" · ") || "Nessun contatto elaborato",
      });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [uploadImage, uploadDataFile]);

  return { processFiles, uploading, progress };
}

/* ═══ Drop Zone ═══ */

const ACCEPTED_TYPES = "image/*,.csv,.xlsx,.xls,.json,.vcf,.txt";

function DropZone({ onFiles, uploading, progress }: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
  progress: { current: number; total: number };
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      isImageFile(f) || isDataFile(f)
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
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          {progress.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {progress.current} / {progress.total} file
            </p>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Camera className="w-6 h-6 text-violet-400" />
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
      )}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {uploading ? "Elaborazione in corso..." : "Trascina foto o file dati"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          📸 JPG, PNG, HEIC (AI Vision) · 📄 CSV, XLSX, JSON, VCF (parsing diretto)
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
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

  const hasPhoto = !!card.photo_url;

  return (
    <div className="bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 backdrop-blur-sm border border-violet-500/10 rounded-2xl overflow-hidden">
      {/* Photo thumbnail — only for image-based cards */}
      {hasPhoto && (
        <AspectRatio ratio={16 / 9}>
          <img
            src={card.photo_url!}
            alt="Biglietto da visita"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </AspectRatio>
      )}

      {/* Data-only indicator for file-imported cards */}
      {!hasPhoto && (
        <div className="h-10 bg-gradient-to-r from-emerald-500/10 to-violet-500/10 flex items-center justify-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium">Da file</span>
        </div>
      )}

      <div className="p-3 space-y-2">
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

        {/* Contact info for data-imported cards */}
        {!hasPhoto && (card.email || card.phone || card.mobile) && (
          <div className="space-y-0.5">
            {card.email && (
              <p className="text-[10px] text-muted-foreground truncate">✉ {card.email}</p>
            )}
            {(card.phone || card.mobile) && (
              <p className="text-[10px] text-muted-foreground truncate">📞 {card.phone || card.mobile}</p>
            )}
          </div>
        )}

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

        <div className="flex flex-wrap gap-1">
          <Badge className={cn("text-[9px]", statusColors[card.match_status] || statusColors.pending)}>
            {card.match_status === "matched" ? "Matchato" : card.match_status === "unmatched" ? "Non trovato" : "In attesa"}
          </Badge>
          {hasPhoto && (
            <Badge variant="outline" className="text-[9px] border-violet-500/15">📸 Foto</Badge>
          )}
          {card.email && hasPhoto && (
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

  const { processFiles, uploading, progress } = useUploadAndParse();
  const { data: cards = [], isLoading } = useBusinessCards({
    event_name: eventFilter || undefined,
    match_status: statusFilter || undefined,
  });

  const eventNames = [...new Set(cards.map((c) => c.event_name).filter(Boolean))] as string[];

  // Summary of pending files
  const pendingImages = pendingFiles.filter(isImageFile).length;
  const pendingData = pendingFiles.filter(isDataFile).length;

  const handleFiles = useCallback((files: File[]) => {
    setPendingFiles(files);
    setShowEventDialog(true);
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    setShowEventDialog(false);
    const meta = { event_name: eventName || undefined, met_at: metAt || undefined, location: location || undefined };
    await processFiles(pendingFiles, meta);
    setPendingFiles([]);
  }, [pendingFiles, eventName, metAt, location, processFiles]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <DropZone onFiles={handleFiles} uploading={uploading} progress={progress} />

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
          <p className="text-xs text-muted-foreground/60 mt-1">Carica foto o file dati per iniziare</p>
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
            {/* File summary */}
            <div className="flex gap-2 flex-wrap">
              {pendingImages > 0 && (
                <Badge variant="outline" className="text-[10px] border-violet-500/20">
                  📸 {pendingImages} foto → AI Vision
                </Badge>
              )}
              {pendingData > 0 && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/20">
                  📄 {pendingData} file dati → parsing diretto
                </Badge>
              )}
            </div>

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
              Opzionale — puoi saltare
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
              {pendingImages > 0 && pendingData > 0
                ? "Carica tutto"
                : pendingImages > 0
                  ? "Carica e analizza"
                  : "Importa contatti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
