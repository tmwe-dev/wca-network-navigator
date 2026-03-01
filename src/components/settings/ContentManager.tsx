import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspacePresets, WorkspacePreset } from "@/hooks/useWorkspacePresets";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { DEFAULT_GOALS, DEFAULT_PROPOSALS, ContentItem } from "@/data/defaultContentPresets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Target, FileText, Link2, Plus, Trash2, Save, Loader2,
  Upload, ExternalLink, Edit2, X, File, RefreshCw,
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
/*  CONTENT ITEM CARD (Goal or Proposal)       */
/* ═══════════════════════════════════════════ */
function ContentItemCard({ item, onSave, onDelete }: {
  item: ContentItem;
  onSave: (updated: ContentItem, original: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [text, setText] = useState(item.text);

  const handleSave = () => {
    onSave({ name, text }, item);
    setEditing(false);
  };

  const handleCancel = () => {
    setName(item.name);
    setText(item.text);
    setEditing(false);
  };

  return (
    <Card>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center justify-between">
          {editing ? (
            <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm font-medium max-w-[280px]" />
          ) : (
            <p className="font-medium text-sm">{item.name}</p>
          )}
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleCancel}><X className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="default" onClick={handleSave}><Save className="w-3.5 h-3.5" /></Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(item)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </>
            )}
          </div>
        </div>
        {editing ? (
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={3} className="text-xs" />
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-3">{item.text}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════ */
/*  CONTENT LIST SECTION                       */
/* ═══════════════════════════════════════════ */
function ContentListSection({ 
  title, icon: Icon, settingKey, defaults, items, onUpdate 
}: {
  title: string;
  icon: React.ElementType;
  settingKey: string;
  defaults: ContentItem[];
  items: ContentItem[];
  onUpdate: (key: string, items: ContentItem[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    const updated = [...items, { name: newName.trim(), text: newText.trim() }];
    onUpdate(settingKey, updated);
    setNewName("");
    setNewText("");
    setAdding(false);
    toast.success("Elemento aggiunto");
  };

  const handleSave = (updated: ContentItem, original: ContentItem) => {
    const list = items.map(i => i.name === original.name && i.text === original.text ? updated : i);
    onUpdate(settingKey, list);
    toast.success("Elemento aggiornato");
  };

  const handleDelete = (item: ContentItem) => {
    const list = items.filter(i => !(i.name === item.name && i.text === item.text));
    onUpdate(settingKey, list);
    toast.success("Elemento eliminato");
  };

  const handleLoadDefaults = () => {
    const existingNames = new Set(items.map(i => i.name));
    const newDefaults = defaults.filter(d => !existingNames.has(d.name));
    if (newDefaults.length === 0) {
      toast.info("Tutti i default sono già presenti");
      return;
    }
    onUpdate(settingKey, [...items, ...newDefaults]);
    toast.success(`${newDefaults.length} elementi predefiniti aggiunti`);
  };

  return (
    <AccordionItem value={settingKey} className="border rounded-lg px-2">
      <AccordionTrigger className="text-sm font-medium gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-2 pb-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nessun elemento salvato</p>
        ) : (
          items.map((item, i) => (
            <ContentItemCard key={`${item.name}-${i}`} item={item} onSave={handleSave} onDelete={handleDelete} />
          ))
        )}

        {adding ? (
          <Card>
            <CardContent className="py-3 px-4 space-y-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome" className="h-7 text-sm" />
              <Textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Descrizione..." rows={3} className="text-xs" />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Annulla</Button>
                <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>Salva</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setAdding(true)}>
              <Plus className="w-3.5 h-3.5" /> Aggiungi
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLoadDefaults}>
              <RefreshCw className="w-3.5 h-3.5" /> Carica default
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

/* ═══════════════════════════════════════════ */
/*  MAIN COMPONENT                             */
/* ═══════════════════════════════════════════ */
export default function ContentManager() {
  const { presets, isLoading: loadingPresets } = useWorkspacePresets();
  const { data: settings, isLoading: loadingSettings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");

  /* ── Parse goals & proposals from app_settings ── */
  const goals: ContentItem[] = useMemo(() => {
    if (!settings?.custom_goals) return [];
    try { return JSON.parse(settings.custom_goals); } catch { return []; }
  }, [settings]);

  const proposals: ContentItem[] = useMemo(() => {
    if (!settings?.custom_proposals) return [];
    try { return JSON.parse(settings.custom_proposals); } catch { return []; }
  }, [settings]);

  /* ── Auto-load defaults on first visit ── */
  useEffect(() => {
    if (loadingSettings || !settings) return;
    if (!settings.custom_goals && !settings.custom_proposals) {
      // First time: seed with defaults
      updateSetting.mutate({ key: "custom_goals", value: JSON.stringify(DEFAULT_GOALS) });
      updateSetting.mutate({ key: "custom_proposals", value: JSON.stringify(DEFAULT_PROPOSALS) });
    }
  }, [loadingSettings, settings]);

  const handleUpdateItems = (key: string, items: ContentItem[]) => {
    updateSetting.mutate({ key, value: JSON.stringify(items) });
  };

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
  const { save } = useWorkspacePresets();
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    const target = presets[0];
    if (!target) { toast.error("Crea prima un preset nel Workspace"); return; }
    const links = [...(target.reference_links || []), newLinkUrl.trim()];
    save.mutate({
      id: target.id, name: target.name, goal: target.goal, base_proposal: target.base_proposal,
      document_ids: target.document_ids, reference_links: links,
    }, { onSuccess: () => { setNewLinkUrl(""); toast.success("Link aggiunto"); } });
  };

  const isLoading = loadingPresets || loadingDocs || loadingSettings;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Contenuti</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{goals.length} goal</Badge>
          <Badge variant="secondary">{proposals.length} proposte</Badge>
          <Badge variant="secondary">{documents.length} documenti</Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Accordion type="multiple" defaultValue={["custom_goals", "custom_proposals", "documents", "links"]} className="space-y-2">
          {/* ═══ GOALS ═══ */}
          <ContentListSection
            title="Goal"
            icon={Target}
            settingKey="custom_goals"
            defaults={DEFAULT_GOALS}
            items={goals}
            onUpdate={handleUpdateItems}
          />

          {/* ═══ PROPOSALS ═══ */}
          <ContentListSection
            title="Proposte"
            icon={FileText}
            settingKey="custom_proposals"
            defaults={DEFAULT_PROPOSALS}
            items={proposals}
            onUpdate={handleUpdateItems}
          />

          {/* ═══ DOCUMENTS ═══ */}
          <AccordionItem value="documents" className="border rounded-lg px-2">
            <AccordionTrigger className="text-sm font-medium gap-2">
              <div className="flex items-center gap-2"><File className="w-4 h-4 text-primary" /> Documenti
                <Badge variant="secondary" className="text-[10px]">{documents.length}</Badge>
              </div>
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
              <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Link di riferimento
                <Badge variant="secondary" className="text-[10px]">{allLinks.length}</Badge>
              </div>
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
                <p className="text-xs text-muted-foreground text-center py-4">Nessun link salvato</p>
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
