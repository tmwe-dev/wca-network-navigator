import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, ThumbsUp, ThumbsDown, RefreshCw, Mic, MessageSquare, Volume2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listAiInteractions, listFeedbackForInteractions, upsertFeedback, deleteFeedback,
  type AiInteractionLogRow, type AiFeedbackRow, type AiInteractionType,
} from "@/data/aiInteractionLog";

const TYPE_LABELS: Record<AiInteractionType, string> = {
  chat_text: "Chat testo",
  voice_tts: "Voce AI (TTS)",
  voice_conversation: "Conversazione vocale",
  voice_stt: "Voce utente (STT)",
};

function typeIcon(t: AiInteractionType) {
  if (t === "chat_text") return <MessageSquare className="h-3 w-3" />;
  if (t === "voice_tts") return <Volume2 className="h-3 w-3" />;
  if (t === "voice_stt") return <Mic className="h-3 w-3" />;
  return <Volume2 className="h-3 w-3" />;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: AiInteractionLogRow[], feedback: Map<string, AiFeedbackRow>): string {
  const header = [
    "id","created_at","interaction_type","role","surface","conversation_id",
    "agent_id","model_id","voice_id","language","duration_ms","page_context",
    "feedback_rating","feedback_note","content",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    const fb = feedback.get(r.id);
    lines.push([
      r.id, r.created_at, r.interaction_type, r.role, r.surface ?? "", r.conversation_id ?? "",
      r.agent_id ?? "", r.model_id ?? "", r.voice_id ?? "", r.language ?? "",
      r.duration_ms ?? "", r.page_context ?? "",
      fb?.rating ?? "", fb?.note ?? "", r.content,
    ].map(escape).join(","));
  }
  return lines.join("\n");
}

export default function AiInteractionLogPage() {
  const [rows, setRows] = useState<AiInteractionLogRow[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Map<string, AiFeedbackRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AiInteractionType | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAiInteractions({
        search,
        interaction_type: typeFilter,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        limit: 1000,
      });
      setRows(data);
      const fbs = await listFeedbackForInteractions(data.map((r) => r.id));
      const map = new Map<string, AiFeedbackRow>();
      fbs.forEach((f) => map.set(f.interaction_id, f));
      setFeedbackMap(map);
    } catch (e) {
      toast({ variant: "destructive", title: "Errore caricamento", description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    rows.forEach((r) => byType.set(r.interaction_type, (byType.get(r.interaction_type) ?? 0) + 1));
    let neg = 0; let pos = 0;
    feedbackMap.forEach((f) => { if (f.rating === -1) neg++; else pos++; });
    return { total: rows.length, byType, neg, pos };
  }, [rows, feedbackMap]);

  const handleRate = async (interaction_id: string, rating: -1 | 1) => {
    const existing = feedbackMap.get(interaction_id);
    try {
      if (existing && existing.rating === rating) {
        await deleteFeedback(interaction_id);
        const m = new Map(feedbackMap); m.delete(interaction_id); setFeedbackMap(m);
      } else {
        await upsertFeedback({ interaction_id, rating, note: existing?.note ?? undefined });
        await load();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Errore", description: String(e) });
    }
  };

  const saveNote = async (interaction_id: string) => {
    const existing = feedbackMap.get(interaction_id);
    try {
      await upsertFeedback({
        interaction_id,
        rating: existing?.rating ?? -1,
        note: noteDraft,
      });
      setOpenNoteFor(null);
      setNoteDraft("");
      await load();
      toast({ title: "Nota salvata" });
    } catch (e) {
      toast({ variant: "destructive", title: "Errore", description: String(e) });
    }
  };

  const exportJson = () => {
    const payload = rows.map((r) => ({ ...r, feedback: feedbackMap.get(r.id) ?? null }));
    downloadFile(`ai-interactions-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const exportCsv = () => {
    downloadFile(`ai-interactions-${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows, feedbackMap), "text/csv");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registro Interazioni AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tutte le chat, le risposte vocali e i prompt utente. Marca le risposte sbagliate per migliorare i prompt nel tempo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button size="sm" onClick={exportJson} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Totali</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Chat testo</div><div className="text-2xl font-bold">{stats.byType.get("chat_text") ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Voce AI (TTS)</div><div className="text-2xl font-bold">{stats.byType.get("voice_tts") ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Voce utente</div><div className="text-2xl font-bold">{stats.byType.get("voice_stt") ?? 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">👍 / 👎</div><div className="text-2xl font-bold">{stats.pos} / <span className="text-destructive">{stats.neg}</span></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filtri</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input placeholder="Cerca nel testo…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load()} />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as AiInteractionType | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              <SelectItem value="chat_text">Chat testo</SelectItem>
              <SelectItem value="voice_tts">Voce AI (TTS)</SelectItem>
              <SelectItem value="voice_conversation">Conversazione vocale</SelectItem>
              <SelectItem value="voice_stt">Voce utente (STT)</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={() => void load()} disabled={loading}>Applica</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nessuna interazione registrata con questi filtri.</CardContent></Card>
        )}
        {rows.map((r) => {
          const fb = feedbackMap.get(r.id);
          return (
            <Card key={r.id} className={r.role === "assistant" ? "border-primary/20" : ""}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">{typeIcon(r.interaction_type)} {TYPE_LABELS[r.interaction_type]}</Badge>
                  <Badge variant={r.role === "assistant" ? "default" : "secondary"}>{r.role}</Badge>
                  {r.surface && <Badge variant="outline">{r.surface}</Badge>}
                  {r.voice_id && <Badge variant="outline">voice: {r.voice_id.slice(0, 10)}…</Badge>}
                  {r.duration_ms != null && <span className="text-muted-foreground">{r.duration_ms}ms</span>}
                  <span className="text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleString("it-IT")}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{r.content}</div>
                {r.role === "assistant" && (
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <Button size="sm" variant={fb?.rating === 1 ? "default" : "ghost"} onClick={() => void handleRate(r.id, 1)}>
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant={fb?.rating === -1 ? "destructive" : "ghost"} onClick={() => void handleRate(r.id, -1)}>
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setOpenNoteFor(r.id); setNoteDraft(fb?.note ?? ""); }}>
                      {fb?.note ? "Modifica nota" : "+ Nota"}
                    </Button>
                    {fb?.note && <span className="text-xs text-muted-foreground italic">"{fb.note}"</span>}
                  </div>
                )}
                {openNoteFor === r.id && (
                  <div className="space-y-2 pt-2">
                    <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Cosa è andato storto? Cosa avresti voluto come risposta?" rows={3} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveNote(r.id)}>Salva nota</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setOpenNoteFor(null); setNoteDraft(""); }}>Annulla</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}