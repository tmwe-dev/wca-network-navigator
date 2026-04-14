import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Trash2, Copy, Check, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface EmailImage {
  name: string;
  url: string;
  created_at: string;
}

interface ImageGalleryTabProps {
  onInsertImage: (url: string) => void;
}

export function ImageGalleryTab({ onInsertImage }: ImageGalleryTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["email-images"],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("email-images").list("", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      return (data || [])
        .filter(f => f.name && !f.name.startsWith("."))
        .map(f => {
          const { data: urlData } = supabase.storage.from("email-images").getPublicUrl(f.name);
          return { name: f.name, url: urlData.publicUrl, created_at: f.created_at || "" };
        }) as EmailImage[];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} non è un'immagine`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} supera 5MB`);
          continue;
        }
        const ext = file.name.split(".").pop() || "png";
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("email-images").upload(path, file, { contentType: file.type });
        if (error) throw error;
      }
      toast.success("Immagini caricate");
      queryClient.invalidateQueries({ queryKey: ["email-images"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteImage = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.storage.from("email-images").remove([name]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-images"] });
      toast.success("Immagine eliminata");
    },
  });

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("URL copiato");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Upload */}
      <div className="shrink-0 px-2 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? "Caricamento..." : "Carica immagine"}
        </Button>
      </div>

      {/* Gallery */}
      <ScrollArea className="flex-1 px-2 py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-6">
            <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-[10px] text-muted-foreground">Nessuna immagine caricata</p>
            <p className="text-[10px] text-muted-foreground/70">Carica logo, banner o grafiche per le email</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {images.map(img => (
              <div key={img.name} className="group relative rounded-md overflow-hidden border border-border/30 aspect-square bg-muted/20">
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => onInsertImage(img.url)}
                  title="Clicca per inserire nell'email"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1 gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-white hover:bg-white/20"
                    onClick={(e) => { e.stopPropagation(); copyUrl(img.url); }}
                    title="Copia URL"
                    aria-label="Copia"
                  >
                    {copiedUrl === img.url ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-white hover:bg-destructive/50"
                    onClick={(e) => { e.stopPropagation(); deleteImage.mutate(img.name); }}
                    title="Elimina"
                    aria-label="Elimina"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
