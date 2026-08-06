import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { createWorkspaceDoc, deleteWorkspaceDoc } from "@/data/workspaceDocs";
import { uploadWorkspaceDocFile, createWorkspaceDocSignedUrl } from "@/data/workspaceDocsStorage";
import { toRecordOrNull } from "@/lib/records";

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

      await uploadWorkspaceDocFile(path, file);

      const signedUrl = await createWorkspaceDocSignedUrl(path, 60 * 60 * 24 * 365);

      const data = await toRecordOrNull(
        createWorkspaceDoc({
          file_name: file.name,
          file_url: signedUrl || path,
          file_size: file.size,
        }),
      );

      const doc: WorkspaceDoc = {
        id: String(data?.id ?? ""),
        file_name: String(data?.file_name ?? file.name),
        file_url: String(data?.file_url ?? path),
        file_size: Number(data?.file_size ?? file.size),
      };
      setDocuments((prev) => [...prev, doc]);
      toast({ title: "Documento caricato", description: file.name });
      return doc;
    } catch (err: unknown) {
      toast({
        title: "Errore upload",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
