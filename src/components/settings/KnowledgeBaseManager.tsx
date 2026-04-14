import { useState, useMemo } from "react";
import { useKbEntries, useUpsertKbEntry, useDeleteKbEntry, useSeedKbFromLegacy, type KbEntry } from "@/hooks/useKbEntries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Search, Download, Sparkles, Star, BookOpen } from "lucide-react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  regole_sistema: "🔒 Regole Sistema",
  filosofia: "🧠 Filosofia Vendita",
  negoziazione: "⚡ Negoziazione",
  chris_voss: "🎯 Chris Voss",
  struttura_email: "📧 Struttura Email",
  hook: "🪝 Hook/Apertura",
  dati_partner: "📊 Uso Dati Partner",
  cold_outreach: "❄️ Cold Outreach",
  arsenale: "🛡️ Arsenale Strategico",
  obiezioni: "💬 Gestione Obiezioni",
  chiusura: "🎁 Chiusura",
  followup: "🔄 Follow-up",
  tono: "🎭 Adattamento Tono",
  persuasione: "🧲 Persuasione",
  frasi_modello: "📝 Frasi Modello",
  errori: "⚠️ Errori da Evitare",
  azienda: "🏢 KB Aziendale",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

export function KnowledgeBaseManager() {
  const { data: entries = [], isLoading } = useKbEntries();
  const upsert = useUpsertKbEntry();
  const remove = useDeleteKbEntry();
  const seed = useSeedKbFromLegacy();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [editEntry, setEditEntry] = useState<Partial<KbEntry> | null>(null);
  const [improving, setImproving] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(entries.map(e => e.category));
    return Array.from(cats).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (catFilter !== "all") list = list.filter(e => e.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entries, catFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, KbEntry[]>();
    for (const e of filtered) {
      const key = e.chapter || e.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [filtered]);

  const openNew = () => setEditEntry({
    title: "", content: "", category: "azienda", chapter: "", tags: [], priority: 5, is_active: true
  });

  const handleSave = () => {
    if (!editEntry?.title?.trim() || !editEntry?.content?.trim()) {
      toast.error("Titolo e contenuto sono obbligatori");
      return;
    }
    upsert.mutate(editEntry as any, { onSuccess: () => setEditEntry(null) });
  };

  const handleImproveWithAI = async () => {
    if (!editEntry?.content?.trim()) return;
    setImproving(true);
    try {
      const data = await invokeEdge<Record<string, unknown>>("improve-email", { body: { html_body: editEntry.content, oracle_tone: "professionale", use_kb: false }, context: "KnowledgeBaseManager.improve_email" });
      const improved = data?.body || data?.html;
      if (improved) {
        setEditEntry(prev => ({ ...prev, content: String(improved) }));
        toast.success("Contenuto migliorato con AI");
      }
    } catch (e: unknown) {
      toast.error("Errore AI: " + ((e instanceof Error ? e.message : String(e)) || "sconosciuto"));
    } finally {
      setImproving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span><strong>{entries.length}</strong> schede in <strong>{categories.length}</strong> categorie</span>
          <span>•</span>
          <span>{entries.filter(e => e.is_active).length} attive</span>
        </div>
        <div className="flex items-center gap-2">
          {entries.length === 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => seed.mutate()} disabled={seed.isPending}>
              {seed.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Importa KB predefinita
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs gap-1" onClick={openNew}>
            <Plus className="w-3 h-3" /> Nuova scheda
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca nelle schede..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="Tutte le categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {CATEGORIES.filter(c => categories.includes(c) || c === "azienda").map(c => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards grouped by chapter */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nessuna scheda KB ancora.</p>
          <p className="text-xs mt-1">Clicca "Importa KB predefinita" per caricare le tecniche di vendita.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-muted-foreground">Nessuna scheda trovata per i filtri selezionati.</p>
      ) : (
        Array.from(grouped.entries()).map(([chapter, items]) => (
          <div key={chapter} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {CATEGORY_LABELS[chapter] || chapter}
              <Badge variant="outline" className="ml-2 text-[10px]">{items.length}</Badge>
            </h3>
            <div className="grid gap-2">
              {items.map(entry => (
                <Card key={entry.id} className={cn("transition-all hover:shadow-sm", !entry.is_active && "opacity-50")}>
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(entry.priority, 5) }).map((_, i) => (
                            <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <CardTitle className="text-xs truncate">{entry.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.tags.slice(0, 3).map(t => (
                          <Badge key={t} variant="secondary" className="text-[9px] px-1">{t}</Badge>
                        ))}
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditEntry({ ...entry })} aria-label="Modifica">
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(entry.id)} aria-label="Elimina">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="py-0 pb-2 px-3">
                    <p className="text-[11px] text-muted-foreground line-clamp-6 whitespace-pre-line">{entry.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editEntry} onOpenChange={open => !open && setEditEntry(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">{editEntry?.id ? "Modifica scheda KB" : "Nuova scheda KB"}</DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Titolo</Label>
                <Input value={editEntry.title || ""} onChange={e => setEditEntry(p => ({ ...p, title: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Select value={editEntry.category || "azienda"} onValueChange={v => setEditEntry(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Capitolo</Label>
                  <Input value={editEntry.chapter || ""} onChange={e => setEditEntry(p => ({ ...p, chapter: e.target.value }))} className="h-8 text-xs" placeholder="es. Chris Voss" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Contenuto (max 25 righe)</Label>
                <Textarea
                  value={editEntry.content || ""}
                  onChange={e => setEditEntry(p => ({ ...p, content: e.target.value }))}
                  className="text-xs min-h-[160px] font-mono"
                  rows={12}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {(editEntry.content || "").split("\n").length} righe • {(editEntry.content || "").length} caratteri
                </p>
              </div>
              <div>
                <Label className="text-xs">Tags (separati da virgola)</Label>
                <Input
                  value={(editEntry.tags || []).join(", ")}
                  onChange={e => setEditEntry(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                  className="h-8 text-xs"
                  placeholder="vendita, email, tecnica"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Priorità</Label>
                  <Select value={String(editEntry.priority || 5)} onValueChange={v => setEditEntry(p => ({ ...p, priority: Number(v) }))}>
                    <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editEntry.is_active !== false} onCheckedChange={v => setEditEntry(p => ({ ...p, is_active: v }))} />
                  <Label className="text-xs">Attiva</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleImproveWithAI} disabled={improving}>
              {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Migliora con AI
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
