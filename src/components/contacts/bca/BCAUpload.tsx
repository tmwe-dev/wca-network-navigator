import { useState, useCallback, useRef } from "react";
import { Camera, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useCreateBusinessCard } from "@/hooks/useBusinessCards";
import { toast } from "@/hooks/use-toast";
import { parseBusinessCardFile, isImageFile, isDataFile } from "@/lib/businessCardFileParser";

/* ═══ Upload + Parse hook ═══ */
export function useUploadAndParse() {
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

export function DropZone({ onFiles, uploading, progress }: {
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
