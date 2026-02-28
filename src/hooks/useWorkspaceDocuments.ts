import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface WorkspaceDoc {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
}

export function useWorkspaceDocuments() {
  const [documents, setDocuments] = useState<WorkspaceDoc[]>([]);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("workspace-docs")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = await supabase.storage
        .from("workspace-docs")
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const { data, error } = await supabase
        .from("workspace_documents")
        .insert({
          file_name: file.name,
          file_url: urlData?.signedUrl || path,
          file_size: file.size,
        } as any)
        .select()
        .single();
      if (error) throw error;

      const doc: WorkspaceDoc = {
        id: (data as any).id,
        file_name: (data as any).file_name,
        file_url: (data as any).file_url,
        file_size: (data as any).file_size,
      };
      setDocuments((prev) => [...prev, doc]);
      toast({ title: "Documento caricato", description: file.name });
      return doc;
    } catch (err: any) {
      toast({ title: "Errore upload", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    await supabase.from("workspace_documents").delete().eq("id", docId);
  };

  return { documents, uploading, upload, remove, setDocuments };
}
