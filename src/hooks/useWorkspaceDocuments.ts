import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createWorkspaceDoc, deleteWorkspaceDoc } from "@/data/workspaceDocs";

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

      const data = await createWorkspaceDoc({
          file_name: file.name,
          file_url: urlData?.signedUrl || path,
          file_size: file.size,
        }) as Record<string, unknown>;

      const doc: WorkspaceDoc = {
        id: data?.id ?? "",
        file_name: data?.file_name ?? file.name,
        file_url: data?.file_url ?? path,
        file_size: data?.file_size ?? file.size,
      };
      setDocuments((prev) => [...prev, doc]);
      toast({ title: "Documento caricato", description: file.name });
      return doc;
    } catch (err: unknown) {
      toast({ title: "Errore upload", description: err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err), variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    await deleteWorkspaceDoc(docId);
  };

  return { documents, uploading, upload, remove, setDocuments };
}
