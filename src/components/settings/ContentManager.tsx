import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspacePresets, WorkspacePreset } from "@/hooks/useWorkspacePresets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Target, FileText, Link2, Plus, Trash2, Save, Loader2,
  Upload, ExternalLink, Edit2, X, File, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

/* ═══════════════════════════════════════════ */
/*  PRESET CARD                                */
/* ═══════════════════════════════════════════ */
function PresetCard({ preset, onSave, onDelete }: {
  preset: WorkspacePreset;
  onSave: (p: WorkspacePreset) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(preset.goal);
  const [proposal, setProposal] = useState(preset.base_proposal);
  const [name, setName] = useState(preset.name);

  const handleSave = () => {
    onSave({ ...preset, name, goal, base_proposal: proposal });
    setEditing(false);
  };

  return (
    <Card>
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex items-center justify-between">
          {editing ? (
            <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm font-medium max-w-[200px]" />
          ) : (
            <p className="font-medium text-sm">{preset.name}</p>
          )}
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="default" onClick={handleSave}><Save className="w-3.5 h-3.5" /></Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(preset.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Goal</p>
              <Textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2} className="text-xs" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Proposta</p>
              <Textarea value={proposal} onChange={e => setProposal(e.target.value)} rows={3} className="text-xs" />
            </div>
          </>
        ) : (
          <>
            {preset.goal && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-0.5">Goal</p>
                <p className="text-xs text-foreground/80 line-clamp-2">{preset.goal}</p>
              </div>
            )}
            {preset.base_proposal && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase mb-0.5">Proposta</p>
                <p className="text-xs text-foreground/80 line-clamp-3">{preset.base_proposal}</p>
              </div>
            )}
          </>
        )}

        {preset.reference_links?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {preset.reference_links.map((link, i) => (
              <Badge key={i} variant="outline" className="text-[10px] gap-1">
                <Link2 className="w-2.5 h-2.5" />
                {hostname(link)}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════ */
/*  MAIN COMPONENT                             */
/* ═══════════════════════════════════════════ */
export default function ContentManager() {
  const { presets, isLoading: loadingPresets, save, remove } = useWorkspacePresets();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");

  /* ── Documents from DB ── */
  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["workspace-documents-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  /* ── Aggregated unique links ── */
  const allLinks = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => (p.reference_links || []).forEach(l => set.add(l)));
    return Array.from(set);
  }, [presets]);

  /* ── Preset handlers ── */
  const handleSavePreset = (p: WorkspacePreset) => {
    save.mutate({
      id: p.id, name: p.name, goal: p.goal, base_proposal: p.base_proposal,
      document_ids: p.document_ids, reference_links: p.reference_links,
    }, { onSuccess: () => toast.success("Preset aggiornato") });
  };

  const handleDeletePreset = (id: string) => {
    remove.mutate(id, { onSuccess: () => toast.success("Preset eliminato") });
  };

  const handleNewPreset = () => {
    save.mutate({
      name: `Preset ${presets.length + 1}`, goal: "", base_proposal: "",
      document_ids: [], reference_links: [],
    }, { onSuccess: () => toast.success("Nuovo preset creato") });
  };

  /* ── Document upload ── */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${crypto.randomUUID()}.${file.name.split(".").pop() || "bin"}`;
        const { error: upErr } = await supabase.storage.from("workspace-docs").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = await supabase.storage.from("workspace-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
        const { error: dbErr } = await supabase.from("workspace_documents").insert({
          file_name: file.name, file_url: urlData?.signedUrl || path, file_size: file.size,
        });
        if (dbErr) throw dbErr;
      }
      toast.success(`${files.length} documento/i caricato/i`);
      qc.invalidateQueries({ queryKey: ["workspace-documents-all"] });
    } catch (err: any) {
      toast.error("Errore upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (id: string) => {
    await supabase.from("workspace_documents").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["workspace-documents-all"] });
    toast.success("Documento eliminato");
  };

  /* ── Link add (to first preset) ── */
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    const target = presets[0];
    if (!target) { toast.error("Crea prima un preset"); return; }
    const links = [...(target.reference_links || []), newLinkUrl.trim()];
    save.mutate({
      id: target.id, name: target.name, goal: target.goal, base_proposal: target.base_proposal,
      document_ids: target.document_ids, reference_links: links,
    }, { onSuccess: () => { setNewLinkUrl(""); toast.success("Link aggiunto"); } });
  };

  const isLoading = loadingPresets || loadingDocs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Contenuti</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{presets.length} preset</Badge>
          <Badge variant="secondary">{documents.length} documenti</Badge>
          <Badge variant="secondary">{allLinks.length} link</Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Accordion type="multiple" defaultValue={["presets", "documents", "links"]} className="space-y-2">
          {/* ═══ PRESETS ═══ */}
          <AccordionItem value="presets" className="border rounded-lg px-2">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Goal e Proposte</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4">
              {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nessun preset salvato</p>
              ) : (
                presets.map(p => (
                  <PresetCard key={p.id} preset={p} onSave={handleSavePreset} onDelete={handleDeletePreset} />
                ))
              )}
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleNewPreset}>
                <Plus className="w-3.5 h-3.5" /> Nuovo Preset
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* ═══ DOCUMENTS ═══ */}
          <AccordionItem value="documents" className="border rounded-lg px-2">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Documenti</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.txt" />
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Caricamento..." : "Carica documento"}
              </Button>

              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nessun documento caricato</p>
              ) : (
                documents.map((d: any) => (
                  <Card key={d.id}>
                    <CardContent className="py-2 px-3 flex items-center gap-3">
                      <File className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{d.file_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatSize(d.file_size)} · {new Date(d.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </a>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteDoc(d.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ═══ LINKS ═══ */}
          <AccordionItem value="links" className="border rounded-lg px-2">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Link di riferimento</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4">
              <div className="flex gap-2">
                <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)}
                  placeholder="https://..." className="h-8 text-xs" />
                <Button size="sm" variant="outline" onClick={handleAddLink} disabled={!newLinkUrl.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {allLinks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nessun link salvato nei preset</p>
              ) : (
                <div className="space-y-1">
                  {allLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card text-xs">
                      <img src={`https://www.google.com/s2/favicons?domain=${hostname(link)}&sz=16`} alt="" className="w-4 h-4" />
                      <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">
                        {hostname(link)}
                      </a>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
