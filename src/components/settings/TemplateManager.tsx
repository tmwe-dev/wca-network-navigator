import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, FileText, FileSpreadsheet, Image, File, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { deleteEmailTemplate, createEmailTemplate } from "@/data/emailTemplates";

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-8 h-8 text-destructive" />,
  doc: <FileText className="w-8 h-8 text-muted-foreground" />,
  docx: <FileText className="w-8 h-8 text-muted-foreground" />,
  xls: <FileSpreadsheet className="w-8 h-8 text-emerald-500" />,
  xlsx: <FileSpreadsheet className="w-8 h-8 text-emerald-500" />,
  png: <Image className="w-8 h-8 text-primary" />,
  jpg: <Image className="w-8 h-8 text-primary" />,
  jpeg: <Image className="w-8 h-8 text-primary" />,
};

const TEMPLATE_CATEGORIES = [
  { value: "offerta_cliente", label: "Offerta nuovo cliente" },
  { value: "collaborazione_domestic", label: "Collaborazione nazionale" },
  { value: "collaborazione_international", label: "Collaborazione internazionale" },
  { value: "saluti_festivita", label: "Saluti e festività" },
  { value: "comunicazioni_operative", label: "Comunicazioni operative" },
  { value: "altro", label: "Altro" },
];

function getIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || <File className="w-8 h-8 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TemplateManager() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("altro");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, _error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: { id: string; file_url: string; file_name: string }) => {
      // Delete from storage
      const path = template.file_url.split("/templates/")[1];
      if (path) {
        await supabase.storage.from("templates").remove([decodeURIComponent(path)]);
      }
      // Delete from db
      await deleteEmailTemplate(template.id); const error = null;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template eliminato");
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("templates")
          .upload(safeName, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = await supabase.storage.from("templates").createSignedUrl(safeName, 60 * 60 * 24 * 365);

        await createEmailTemplate({
          name: file.name.replace(/\.[^/.]+$/, ""),
          file_url: urlData?.signedUrl || safeName,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
          category: uploadCategory,
        } as any);
      }
      toast.success(`${files.length} file caricati`);
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    } catch (err: any) {
      toast.error("Errore upload: " + (err.message || "Sconosciuto"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Template & Allegati</h2>
        </div>
        <Badge variant="secondary">{templates.length} file</Badge>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carica documenti</CardTitle>
          <CardDescription>Brochure, listini, presentazioni da allegare alle email delle campagne</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif"
          />
          <div className="flex gap-2 mb-3">
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full gap-2"
            size="lg"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Caricamento..." : "Seleziona file da caricare"}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            PDF, Word, Excel, PowerPoint, immagini — max 20MB per file
          </p>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nessun template caricato. Carica il primo documento!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id}>
              <CardContent className="py-3 px-4 flex items-center gap-4">
                {getIcon(t.file_name)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate text-foreground">{t.name}</p>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {TEMPLATE_CATEGORIES.find(c => c.value === t.category)?.label || t.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.file_name} · {formatSize(t.file_size)} · {new Date(t.created_at).toLocaleDateString("it-IT")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => deleteMutation.mutate({ id: t.id, file_url: t.file_url, file_name: t.file_name })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
