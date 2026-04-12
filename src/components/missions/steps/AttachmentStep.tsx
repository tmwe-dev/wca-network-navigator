import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { findEmailTemplatesShort } from "@/data/emailTemplates";
import type { MissionStepProps, AttachmentConfig } from "./types";

interface TemplateEntry { id: string; name: string; file_url: string }
interface ImageEntry { name: string; url: string }

export function AttachmentStep({ data, onChange }: MissionStepProps) {
  const att = data.attachments || { templateIds: [], imageIds: [], links: [], includeSignatureImage: true };
  const set = (patch: Partial<AttachmentConfig>) => onChange({ ...data, attachments: { ...att, ...patch } });

  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [newLink, setNewLink] = useState("");

  useEffect(() => {
    findEmailTemplatesShort().then((d) => { if (d) setTemplates(d as TemplateEntry[]); });
    supabase.storage.from("email-images").list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } })
      .then(({ data: files }) => {
        if (files) setImages(files.filter(f => f.name && !f.name.startsWith(".")).map(f => {
          const { data: urlData } = supabase.storage.from("email-images").getPublicUrl(f.name);
          return { name: f.name, url: urlData.publicUrl };
        }));
      });
  }, []);

  const addLink = () => {
    if (!newLink.trim()) return;
    set({ links: [...att.links, newLink.trim()] });
    setNewLink("");
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">📎 Documenti da allegare</p>
        {templates.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessun template caricato. Vai su Impostazioni → Template.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
            {templates.map(t => (
              <button key={t.id} onClick={() => {
                const ids = att.templateIds.includes(t.id) ? att.templateIds.filter(x => x !== t.id) : [...att.templateIds, t.id];
                set({ templateIds: ids });
              }} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                att.templateIds.includes(t.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}>{t.name}</button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">🖼️ Immagini nel corpo email</p>
        {images.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessuna immagine. Caricale in Email Composer → tab Immagini.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.slice(0, 10).map(img => (
              <button key={img.name} onClick={() => {
                const ids = att.imageIds.includes(img.name) ? att.imageIds.filter(x => x !== img.name) : [...att.imageIds, img.name];
                set({ imageIds: ids });
              }} className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                att.imageIds.includes(img.name) ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
              }`}><img src={img.url} alt={img.name} className="w-full h-full object-cover" /></button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">🔗 Link da includere</p>
        <div className="flex gap-2">
          <Input value={newLink} onChange={e => setNewLink(e.target.value)} onKeyDown={e => e.key === "Enter" && addLink()} placeholder="https://..." className="text-sm" />
          <Button size="sm" variant="outline" onClick={addLink}>+</Button>
        </div>
        {att.links.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {att.links.map((l, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => set({ links: att.links.filter((_, j) => j !== i) })}>
                {l.substring(0, 30)}... ✕
              </Badge>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
        <Switch checked={att.includeSignatureImage} onCheckedChange={v => set({ includeSignatureImage: v })} />
        <div>
          <div className="text-sm">Includi immagine firma</div>
          <div className="text-xs text-muted-foreground">Aggiunge automaticamente la firma visiva configurata nelle impostazioni</div>
        </div>
      </label>
    </div>
  );
}
