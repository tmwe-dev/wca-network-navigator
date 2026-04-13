import { useState } from "react";
import { Plus, Zap, Loader2, Pause, Play, CheckCircle, Trash2, RefreshCw, Pencil, ChevronDown, ChevronUp, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useOperativeJobs, type OperativeJob } from "@/hooks/useOperativeJobs";
import OperativeGuideSettings from "./OperativeGuideSettings";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS = [
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "phone", label: "Telefono" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  running: { label: "Attivo", color: "bg-green-500/15 text-green-700 dark:text-green-400" },
  paused: { label: "In pausa", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  completed: { label: "Completato", color: "bg-muted text-muted-foreground" },
  draft: { label: "Bozza", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
};

export default function OperativeJobsBoard() {
  const { jobs, isLoading, createJob, updateStatus, deleteJob, generatePrompt, savePrompt } = useOperativeJobs();
  const [showForm, setShowForm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [promptDialog, setPromptDialog] = useState<OperativeJob | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editedPromptText, setEditedPromptText] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [deadline, setDeadline] = useState<Date | undefined>();

  const resetForm = () => { setTitle(""); setDescription(""); setChannels(["email"]); setDeadline(undefined); setShowForm(false); };

  const handleCreate = async () => {
    if (!title.trim()) return;
    const job = await createJob.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      channels,
      deadline: deadline ? format(deadline, "yyyy-MM-dd") : undefined,
    });
    // Auto-generate prompt
    if (job) generatePrompt.mutate(job);
    resetForm();
  };

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const openPromptDialog = (job: OperativeJob) => {
    setPromptDialog(job);
    setEditingPrompt(false);
    setEditedPromptText(job.metadata?.generated_prompt || "");
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Jobs Operativi</h2>
          <Badge variant="secondary" className="text-xs">{jobs.filter(j => j.status === "running").length} attivi</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowRules(!showRules)} className="gap-1 text-xs">
            {showRules ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Regole globali
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Nuovo Job
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Elenco delle attività operative che il Supervisor AI gestisce in parallelo. Ogni job genera automaticamente un prompt AI strutturato (⚡).
      </p>

      {/* Collapsible global rules */}
      {showRules && (
        <Card>
          <CardContent className="pt-4">
            <OperativeGuideSettings />
          </CardContent>
        </Card>
      )}

      {/* New Job Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo job (es. Promozione FindAir ai partner WCA)" />
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Istruzioni libere: cosa fare, come, con quali documenti, tono…" rows={4} />
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map(ch => (
                <Button key={ch.id} variant={channels.includes(ch.id) ? "default" : "outline"} size="sm" onClick={() => toggleChannel(ch.id)}>
                  {ch.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    {deadline ? format(deadline, "dd MMM yyyy", { locale: it }) : "Scadenza (opzionale)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} locale={it} />
                </PopoverContent>
              </Popover>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={resetForm}>Annulla</Button>
              <Button size="sm" onClick={handleCreate} disabled={!title.trim() || createJob.isPending} className="gap-1">
                {createJob.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                Crea e Genera Prompt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs List */}
      {jobs.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nessun job operativo. Crea il primo per iniziare.
        </div>
      )}

      <div className="space-y-2">
        {jobs.map(job => {
          const st = STATUS_MAP[job.status] || STATUS_MAP.draft;
          const hasPrompt = !!job.metadata?.generated_prompt;
          return (
            <Card key={job.id} className={cn("transition-opacity", job.status === "completed" && "opacity-60")}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                {/* Prompt icon */}
                <button
                  onClick={() => openPromptDialog(job)}
                  className={cn(
                    "shrink-0 rounded-md p-1.5 transition-colors",
                    hasPrompt ? "text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground/40 hover:bg-muted"
                  )}
                  title={hasPrompt ? "Visualizza prompt AI" : "Nessun prompt generato"}
                >
                  <Zap className="h-4 w-4" />
                </button>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{job.title}</span>
                    <Badge className={cn("text-[10px] px-1.5 py-0", st.color)}>{st.label}</Badge>
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{job.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {(job.steps?.channels || []).map(ch => (
                      <Badge key={ch} variant="outline" className="text-[10px] px-1">{ch}</Badge>
                    ))}
                    {job.steps?.deadline && (
                      <span className="text-[10px] text-muted-foreground">⏰ {job.steps.deadline}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {job.status === "running" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Pausa" aria-label="Pausa" onClick={() => updateStatus.mutate({ id: job.id, status: "paused" })}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {job.status === "paused" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Riprendi" aria-label="Esegui" onClick={() => updateStatus.mutate({ id: job.id, status: "running" })}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {job.status !== "completed" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Completa" aria-label="Conferma" onClick={() => updateStatus.mutate({ id: job.id, status: "completed" })}>
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Rigenera prompt" aria-label="Aggiorna" onClick={() => generatePrompt.mutate(job)} disabled={generatePrompt.isPending}>
                    {generatePrompt.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Elimina" aria-label="Elimina" onClick={() => deleteJob.mutate(job.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Prompt Dialog */}
      <Dialog open={!!promptDialog} onOpenChange={open => { if (!open) setPromptDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Prompt AI — {promptDialog?.title}
            </DialogTitle>
          </DialogHeader>
          {promptDialog && (
            <div className="space-y-4">
              {editingPrompt ? (
                <>
                  <Textarea
                    value={editedPromptText}
                    onChange={e => setEditedPromptText(e.target.value)}
                    rows={15}
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingPrompt(false)}>Annulla</Button>
                    <Button size="sm" onClick={() => {
                      savePrompt.mutate({ id: promptDialog.id, prompt: editedPromptText, currentMeta: promptDialog.metadata });
                      setPromptDialog({ ...promptDialog, metadata: { ...promptDialog.metadata, generated_prompt: editedPromptText } });
                      setEditingPrompt(false);
                    }}>Salva</Button>
                  </div>
                </>
              ) : (
                <>
                  {promptDialog.metadata?.generated_prompt ? (
                    <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-md p-4 max-h-[50vh] overflow-auto">
                      {promptDialog.metadata.generated_prompt}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nessun prompt generato. Clicca "Genera" per crearne uno.</p>
                  )}
                  {promptDialog.metadata?.prompt_generated_at && (
                    <p className="text-xs text-muted-foreground">
                      Generato: {format(new Date(promptDialog.metadata.prompt_generated_at), "dd MMM yyyy HH:mm", { locale: it })}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditedPromptText(promptDialog.metadata?.generated_prompt || ""); setEditingPrompt(true); }}>
                      <Pencil className="h-3 w-3" /> Modifica
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => generatePrompt.mutate(promptDialog)} disabled={generatePrompt.isPending}>
                      {generatePrompt.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Rigenera
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
