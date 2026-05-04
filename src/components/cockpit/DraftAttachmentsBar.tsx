/**
 * DraftAttachmentsBar — Toolbar per-bozza: Link / Immagini / Allegati.
 * I link entrano nel prompt AI; le immagini vengono inserite inline nel body;
 * gli allegati vengono caricati nel bucket privato cockpit-attachments e
 * propagati a send-email.
 */
import { useRef, useState } from "react";
import { Link as LinkIcon, ImageIcon, Paperclip, Plus, X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageGalleryTab } from "@/components/email/ImageGalleryTab";
import type { DraftState, DraftLink, DraftAttachment } from "@/types/cockpit";

const MAX_ATTACHMENTS = 10;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB

interface Props {
  draft: DraftState;
  onDraftChange: (d: DraftState) => void;
}

export function DraftAttachmentsBar({ draft, onDraftChange }: Props) {
  const links = draft.links ?? [];
  const inlineImages = draft.inlineImages ?? [];
  const attachments = draft.attachments ?? [];

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    const next: DraftLink[] = [...links, { label: linkLabel.trim(), url: linkUrl.trim() }];
    onDraftChange({ ...draft, links: next });
    setLinkLabel(""); setLinkUrl("");
  };
  const removeLink = (i: number) => {
    onDraftChange({ ...draft, links: links.filter((_, idx) => idx !== i) });
  };

  const insertImage = (url: string) => {
    const tag = `<p><img src="${url}" style="max-width:100%;height:auto" /></p>`;
    onDraftChange({
      ...draft,
      body: (draft.body || "") + tag,
      inlineImages: [...inlineImages, url],
    });
    toast.success("Immagine inserita nel corpo email");
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const totalNow = attachments.reduce((s, a) => s + a.size, 0);
    let totalAfter = totalNow;
    const accepted: File[] = [];
    for (const f of Array.from(files)) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        toast.error(`Massimo ${MAX_ATTACHMENTS} allegati`); break;
      }
      totalAfter += f.size;
      if (totalAfter > MAX_TOTAL_BYTES) {
        toast.error("Limite 20MB totali superato"); break;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta");
      const uploaded: DraftAttachment[] = [];
      for (const file of accepted) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("cockpit-attachments").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) throw error;
        uploaded.push({ name: file.name, path, size: file.size, mime: file.type || "application/octet-stream" });
      }
      onDraftChange({ ...draft, attachments: [...attachments, ...uploaded] });
      toast.success(`${uploaded.length} file caricati`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = async (idx: number) => {
    const att = attachments[idx];
    onDraftChange({ ...draft, attachments: attachments.filter((_, i) => i !== idx) });
    void supabase.storage.from("cockpit-attachments").remove([att.path]).catch(() => {});
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Link */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 relative">
            <LinkIcon className="w-3.5 h-3.5" />
            <span className="text-[11px]">Link</span>
            {links.length > 0 && (
              <span className="ml-1 text-[9px] px-1 rounded-full bg-primary text-primary-foreground">{links.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 space-y-2" align="end">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Link suggeriti all'AI</p>
          {links.length > 0 && (
            <div className="space-y-1">
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/40 rounded px-2 py-1">
                  <LinkIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate"><b>{l.label}</b> · <span className="text-muted-foreground">{l.url}</span></span>
                  <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Etichetta (es: Catalogo)" className="h-7 text-xs" />
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="h-7 text-xs" />
          <Button size="sm" onClick={addLink} className="w-full h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Aggiungi link
          </Button>
          <p className="text-[10px] text-muted-foreground">L'AI li citerà nel testo alla prossima rigenerazione/Migliora.</p>
        </PopoverContent>
      </Popover>

      {/* Immagini */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 relative">
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="text-[11px]">Immagini</span>
            {inlineImages.length > 0 && (
              <span className="ml-1 text-[9px] px-1 rounded-full bg-primary text-primary-foreground">{inlineImages.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-3" align="end">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Inserisci immagine inline</p>
          <ScrollArea className="h-[360px] pr-2">
            <ImageGalleryTab onInsertImage={insertImage} />
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Allegati */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 relative">
            <Paperclip className="w-3.5 h-3.5" />
            <span className="text-[11px]">Allegati</span>
            {attachments.length > 0 && (
              <span className="ml-1 text-[9px] px-1 rounded-full bg-primary text-primary-foreground">{attachments.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 space-y-2" align="end">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Allegati email</p>
          {attachments.length > 0 && (
            <div className="space-y-1">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/40 rounded px-2 py-1">
                  <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground">{(a.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" multiple onChange={(e) => handleUpload(e.target.files)} className="hidden" />
          <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="w-full h-7 text-xs gap-1">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Caricamento…" : "Carica file"}
          </Button>
          <p className="text-[10px] text-muted-foreground">Max {MAX_ATTACHMENTS} file, 20MB totali.</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}