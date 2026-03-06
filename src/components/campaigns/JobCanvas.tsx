import { useState, useEffect } from "react";
import { Mail, Phone, MapPin, CheckCircle2, FileText, Calendar, Save, User, Users, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCountryFlag } from "@/lib/countries";
import { useUpdateCampaignJob, useEmailTemplates, type CampaignJob } from "@/hooks/useCampaignJobs";
import type { PartnerContactRecord } from "@/hooks/useActivities";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JobCanvasProps {
  job: CampaignJob | null;
  contacts?: PartnerContactRecord[];
  focusedContactId?: string | null;
  selectedContactIds?: Set<string>;
  onBulkSetType?: (type: "email" | "call") => void;
  onBulkComplete?: () => void;
}

export function JobCanvas({ job, contacts = [], focusedContactId, selectedContactIds, onBulkSetType, onBulkComplete }: JobCanvasProps) {
  const updateJob = useUpdateCampaignJob();
  const { data: templates = [] } = useEmailTemplates();
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Sync notes when job changes (moved to useEffect to avoid setState during render)
  useEffect(() => {
    if (job && job.id !== notesLoaded) {
      setNotes(job.notes || "");
      setNotesLoaded(job.id);
      setSelectedTemplates([]);
    }
  }, [job, notesLoaded]);

  const bulkCount = selectedContactIds?.size || 0;
  const hasBulkSelection = bulkCount > 0;

  if (!job) {
    return (
      <div className="h-full flex flex-col">
        {/* Bulk bar even without focused job */}
        {hasBulkSelection && (
          <BulkActionBar count={bulkCount} onSetType={onBulkSetType} onComplete={onBulkComplete} />
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {hasBulkSelection
                ? `${bulkCount} contatti selezionati — usa le azioni in alto`
                : "Clicca su un contatto dalla lista"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const focusedContact = contacts.find(c => c.id === focusedContactId) || null;

  const handleComplete = () => {
    updateJob.mutate(
      { id: job.id, status: "completed", completed_at: new Date().toISOString() },
      { onSuccess: () => toast.success("Job completato") }
    );
  };

  const handleSetType = (type: "email" | "call") => {
    updateJob.mutate(
      { id: job.id, job_type: type },
      { onSuccess: () => toast.success(`Tipo cambiato a ${type}`) }
    );
  };

  const handleSaveNotes = () => {
    updateJob.mutate(
      { id: job.id, notes },
      { onSuccess: () => toast.success("Note salvate") }
    );
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev =>
      prev.includes(templateId) ? prev.filter(t => t !== templateId) : [...prev, templateId]
    );
  };

  const isCompleted = job.status === "completed";

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("image")) return "🖼️";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    if (fileType.includes("sheet") || fileType.includes("excel")) return "📊";
    return "📎";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Bulk action bar */}
      {hasBulkSelection && (
        <BulkActionBar count={bulkCount} onSetType={onBulkSetType} onComplete={onBulkComplete} />
      )}

      <ScrollArea className="flex-1">
        <div className="flex flex-col p-6 space-y-6">
          {/* Partner Info Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{job.company_name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="text-lg">{getCountryFlag(job.country_code)}</span>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{job.city || ""}{job.city && job.country_name ? ", " : ""}{job.country_name || ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={job.job_type === "email" ? "default" : "secondary"}>
                  {job.job_type === "email" ? <Mail className="w-3 h-3 mr-1" /> : <Phone className="w-3 h-3 mr-1" />}
                  {job.job_type}
                </Badge>
                <Badge variant={isCompleted ? "default" : "outline"} className={isCompleted ? "bg-emerald-600" : ""}>
                  {job.status}
                </Badge>
              </div>
            </div>

            {/* Company-level contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email azienda</p>
                  <p className="text-sm font-medium truncate text-foreground">{job.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Telefono azienda</p>
                  <p className="text-sm font-medium truncate text-foreground">{job.phone || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Focused Contact Detail */}
          {focusedContact && (
            <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Contatto selezionato</h3>
                {focusedContact.is_primary && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Primario</Badge>
                )}
              </div>
              <p className="text-base font-medium text-foreground">{focusedContact.name}</p>
              {focusedContact.title && (
                <p className="text-sm text-muted-foreground">{focusedContact.title}</p>
              )}
              <div className="flex items-center gap-4 text-sm">
                {focusedContact.email ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Mail className="w-3.5 h-3.5" /> {focusedContact.email}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground/50">
                    <Mail className="w-3.5 h-3.5" /> —
                  </span>
                )}
                {(focusedContact.direct_phone || focusedContact.mobile) ? (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Phone className="w-3.5 h-3.5" /> {focusedContact.direct_phone || focusedContact.mobile}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground/50">
                    <Phone className="w-3.5 h-3.5" /> —
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant={job.job_type === "email" ? "default" : "outline"}
              onClick={() => handleSetType("email")}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              Prepara Email
            </Button>
            <Button
              size="lg"
              variant={job.job_type === "call" ? "default" : "outline"}
              onClick={() => handleSetType("call")}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Programma Call
            </Button>
          </div>

          {/* Allegati / Templates */}
          {templates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Allegati disponibili</h3>
              </div>
              <div className="space-y-1.5">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                      selectedTemplates.includes(t.id)
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                    onClick={() => toggleTemplate(t.id)}
                  >
                    <Checkbox
                      checked={selectedTemplates.includes(t.id)}
                      onCheckedChange={() => toggleTemplate(t.id)}
                    />
                    <span className="text-base">{getFileIcon(t.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.file_name} · {(t.file_size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Note</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Appunti sul contatto..."
              className="min-h-[100px] resize-none"
            />
            <Button size="sm" variant="outline" onClick={handleSaveNotes} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Salva note
            </Button>
          </div>

          {/* Complete */}
          {!isCompleted && (
            <Button onClick={handleComplete} size="lg" className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="w-4 h-4" />
              Segna come completato
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Bulk Action Bar ── */
function BulkActionBar({ count, onSetType, onComplete }: {
  count: number;
  onSetType?: (type: "email" | "call") => void;
  onComplete?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-primary/20 bg-primary/5 flex-shrink-0">
      <Badge variant="default" className="bg-primary text-primary-foreground">
        {count} selezionati
      </Badge>
      <div className="flex-1" />
      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => onSetType?.("email")}>
        <Mail className="w-3 h-3" /> Email
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => onSetType?.("call")}>
        <Phone className="w-3 h-3" /> Call
      </Button>
      <Button size="sm" className="gap-1.5 text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onComplete?.()}>
        <CheckCircle2 className="w-3 h-3" /> Completa
      </Button>
    </div>
  );
}
