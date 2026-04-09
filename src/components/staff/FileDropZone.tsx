import { useState, useCallback, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  onFileUploaded: (url: string, fileName: string) => void;
  className?: string;
}

export function FileDropZone({ children, onFileUploaded, className }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      const path = `staff/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        onFileUploaded(data.publicUrl, file.name);
      }
    }
    setUploading(false);
  }, [onFileUploaded]);

  return (
    <div
      className={cn("relative", className)}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {children}
      {dragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Rilascia file qui</span>
          </div>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 z-50 bg-background/60 flex items-center justify-center backdrop-blur-sm rounded-xl">
          <span className="text-sm text-muted-foreground animate-pulse">Caricamento…</span>
        </div>
      )}
    </div>
  );
}
