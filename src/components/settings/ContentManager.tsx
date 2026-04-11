import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useWorkspacePresets } from "@/hooks/useWorkspacePresets";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { DEFAULT_GOALS, DEFAULT_PROPOSALS, ContentItem, CONTENT_CATEGORIES } from "@/data/defaultContentPresets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BookOpen, Target, FileText, Link2, Plus, Trash2, Save, Loader2,
  Upload, ExternalLink, X, File, RefreshCw,
  Handshake, Mail, Search, Globe, Briefcase, TrendingUp, Users, Package, FileCheck,
  ChevronDown, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { findWorkspaceDocs, createWorkspaceDoc, deleteWorkspaceDoc } from "@/data/workspaceDocs";

const log = createLogger("ContentManager");

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  primo_contatto: Handshake,
  follow_up: RefreshCw,
  richiesta: Search,
  proposta_servizi: Briefcase,
  partnership: Globe,
  altro: FileText,
};

const CARD_ICONS = [Target, Handshake, Mail, Search, Globe, Briefcase, TrendingUp, Users, Package, FileCheck];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return url; }
}

function ContentGridView({ settingKey, defaults, items, onUpdate, contentType }: {
  settingKey: string;
  defaults: ContentItem[];
  items: ContentItem[];
  onUpdate: (key: string, items: ContentItem[]) => void;
  contentType: "goal" | "proposal";
}) {
  const [editItem, setEditItem] = useState<{ item: ContentItem; index: number } | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("altro");
  const [categorizing, setCategorizing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const groups: Record<string, { items: ContentItem[]; indices: number[] }> = {};
    items.forEach((item, i) => {
      const cat = item.category || "altro";
      if (!groups[cat]) groups[cat] = { items: [], indices: [] };
      groups[cat].items.push(item);
      groups[cat].indices.push(i);
    });
    // Sort by CONTENT_CATEGORIES order
    const ordered: { key: string; label: string; items: ContentItem[]; indices: number[] }[] = [];
    for (const cat of CONTENT_CATEGORIES) {
      if (groups[cat.key]) {
        ordered.push({ key: cat.key, label: cat.label, ...groups[cat.key] });
      }
    }
    // Any remaining keys not in CONTENT_CATEGORIES
    for (const key of Object.keys(groups)) {
      if (!CONTENT_CATEGORIES.some(c => c.key === key)) {
        ordered.push({ key, label: key, ...groups[key] });
      }
    }
    return ordered;
  }, [items]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const openEdit = (item: ContentItem, index: number) => {
    setEditItem({ item, index });
    setEditName(item.name);
    setEditText(item.text);
    setEditCategory(item.category || "altro");
    setIsNew(false);
  };

  const openNew = () => {
    setEditItem({ item: { name: "", text: "" }, index: -1 });
    setEditName("");
    setEditText("");
    setEditCategory("altro");
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    let finalCategory = editCategory;

    // AI auto-categorize for new items
    if (isNew && editText.trim()) {
      setCategorizing(true);
      try {
        const data = await invokeEdge<{ category?: string }>("categorize-content", { body: { name: editName.trim(), text: editText.trim(), type: contentType === "proposal" ? "proposal" : "goal" }, context: "ContentManager.categorize_content" });
        if (data?.category) {
          finalCategory = data.category;
        }
      } catch (e) { log.debug("fallback used", { error: e instanceof Error ? e.message : String(e) }); /* fallback to manual */ }
      setCategorizing(false);
    }

    const newItem: ContentItem = { name: editName.trim(), text: editText.trim(), category: finalCategory };
    if (isNew) {
      onUpdate(settingKey, [...items, newItem]);
      toast.success("Elemento aggiunto");
    } else if (editItem) {
      const updated = [...items];
      updated[editItem.index] = { ...newItem, category: editCategory };
      onUpdate(settingKey, updated);
      toast.success("Elemento aggiornato");
    }
    setEditItem(null);
  };

  const handleDelete = (index: number) => {
    onUpdate(settingKey, items.filter((_, i) => i !== index));
    toast.success("Elemento eliminato");
  };

  const handleLoadDefaults = () => {
    const existingNames = new Set(items.map(i => i.name));
    const newDefaults = defaults.filter(d => !existingNames.has(d.name));
    if (newDefaults.length === 0) { toast.info("Tutti i default sono già presenti"); return; }
    onUpdate(settingKey, [...items, ...newDefaults]);
    toast.success(`${newDefaults.length} elementi predefiniti aggiunti`);
  };

  const availableCategories = contentType === "proposal"
    ? CONTENT_CATEGORIES.filter(c => ["proposta_servizi", "partnership", "altro"].includes(c.key))
    : CONTENT_CATEGORIES;

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLoadDefaults}>
            <RefreshCw className="w-3.5 h-3.5" /> Carica default
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" /> Nuovo
          </Button>
        </div>

        {grouped.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nessun elemento. Clicca "Carica default" per iniziare.
          </div>
        ) : (
          grouped.map(group => {
            const CatIcon = CATEGORY_ICONS[group.key] || FileText;
            const isOpen = !collapsedSections.has(group.key);
            return (
              <div key={group.key} className="space-y-2">
                <button
                  onClick={() => toggleSection(group.key)}
                  className="flex items-center gap-2 w-full text-left px-1 py-1.5 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <CatIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">{group.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.items.length}</Badge>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>

                {isOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pl-1">
                    {group.items.map((item, gi) => {
                      const realIndex = group.indices[gi];
                      const Icon = CARD_ICONS[realIndex % CARD_ICONS.length];
                      return (
                        <Card
                          key={`${item.name}-${realIndex}`}
                          className="group cursor-pointer hover:border-primary/50 transition-colors relative"
                          onClick={() => openEdit(item, realIndex)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-2 min-h-[120px]">
                            <Icon className="w-6 h-6 text-primary shrink-0" />
                            <p className="text-sm font-medium line-clamp-2 leading-tight">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-2">{item.text}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive h-6 w-6 p-0"
                              onClick={(e) => { e.stopPropagation(); handleDelete(realIndex); }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuovo elemento" : "Modifica elemento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Nome"
              className="text-sm"
            />
            <Textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              placeholder="Descrizione..."
              rows={5}
              className="text-sm"
            />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                Categoria
                {isNew && <span className="flex items-center gap-0.5 text-primary"><Sparkles className="w-3 h-3" /> auto AI</span>}
              </label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Annulla</Button>
            <Button onClick={handleSave} disabled={!editName.trim() || categorizing}>
              {categorizing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {categorizing ? "Categorizzo..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ContentManager() {
  const { presets, isLoading: loadingPresets } = useWorkspacePresets();
  const { data: settings, isLoading: loadingSettings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const goals: ContentItem[] = useMemo(() => {
    if (!settings?.custom_goals) return [];
    try { return JSON.parse(settings.custom_goals); } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return []; }
  }, [settings]);

  const proposals: ContentItem[] = useMemo(() => {
    if (!settings?.custom_proposals) return [];
    try { return JSON.parse(settings.custom_proposals); } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return []; }
  }, [settings]);

  useEffect(() => {
    if (loadingSettings || !settings) return;
    if (!settings.custom_goals && !settings.custom_proposals) {
      updateSetting.mutate({ key: "custom_goals", value: JSON.stringify(DEFAULT_GOALS) });
      updateSetting.mutate({ key: "custom_proposals", value: JSON.stringify(DEFAULT_PROPOSALS) });
    }
  }, [loadingSettings, settings]);

  const handleUpdateItems = (key: string, items: ContentItem[]) => {
    updateSetting.mutate({ key, value: JSON.stringify(items) });
  };

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["workspace-documents-all"],
    queryFn: async () => {
      const data = await findWorkspaceDocs(); const error = null;
      if (error) throw error;
      return data || [];
    },
  });

  const allLinks = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => ((p.reference_links as string[] | null) || []).forEach((l: string) => set.add(l)));
    return Array.from(set);
  }, [presets]);

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
        await createWorkspaceDoc({
          file_name: file.name, file_url: urlData?.signedUrl || path, file_size: file.size,
        });
      }
      toast.success(`${files.length} documento/i caricato/i`);
      qc.invalidateQueries({ queryKey: ["workspace-documents-all"] });
    } catch (err: any) { toast.error("Errore upload: " + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleDeleteDoc = async (id: string) => {
    await deleteWorkspaceDoc(id);
    qc.invalidateQueries({ queryKey: ["workspace-documents-all"] });
    toast.success("Documento eliminato");
  };

  const { save } = useWorkspacePresets();
  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    const target = presets[0];
    if (!target) { toast.error("Crea prima un preset nel Workspace"); return; }
    const links = [...((target.reference_links as string[] | null) || []), newLinkUrl.trim()];
    save.mutate({
      id: target.id, name: target.name, goal: target.goal ?? "", base_proposal: target.base_proposal ?? "",
      document_ids: (target.document_ids as string[] | null) ?? [], reference_links: links,
    }, { onSuccess: () => { setNewLinkUrl(""); toast.success("Link aggiunto"); } });
  };

  const isLoading = loadingPresets || loadingDocs || loadingSettings;

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

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
          <Badge variant="secondary">{documents.length} doc</Badge>
        </div>
      </div>

      <Tabs defaultValue="goals" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="goals" className="gap-1.5 text-xs">
            <Target className="w-3.5 h-3.5" /> Goal
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Proposte
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs">
            <File className="w-3.5 h-3.5" /> Documenti
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5 text-xs">
            <Link2 className="w-3.5 h-3.5" /> Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="m-0">
          <ContentGridView settingKey="custom_goals" defaults={DEFAULT_GOALS} items={goals} onUpdate={handleUpdateItems} contentType="goal" />
        </TabsContent>

        <TabsContent value="proposals" className="m-0">
          <ContentGridView settingKey="custom_proposals" defaults={DEFAULT_PROPOSALS} items={proposals} onUpdate={handleUpdateItems} contentType="proposal" />
        </TabsContent>

        <TabsContent value="documents" className="m-0 space-y-2">
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
        </TabsContent>

        <TabsContent value="links" className="m-0 space-y-2">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
