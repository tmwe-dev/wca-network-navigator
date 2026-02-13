import { useState } from "react";
import { Mail, Phone, MapPin, Building2, CheckCircle2, FileText, Calendar, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getCountryFlag } from "@/lib/countries";
import { useUpdateCampaignJob, type CampaignJob } from "@/hooks/useCampaignJobs";
import { toast } from "sonner";

interface JobCanvasProps {
  job: CampaignJob | null;
}

export function JobCanvas({ job }: JobCanvasProps) {
  const updateJob = useUpdateCampaignJob();
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState<string | null>(null);

  // Sync notes when job changes
  if (job && job.id !== notesLoaded) {
    setNotes(job.notes || "");
    setNotesLoaded(job.id);
  }

  if (!job) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Seleziona un job dalla lista</p>
        </div>
      </div>
    );
  }

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

  const isCompleted = job.status === "completed";

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      {/* Partner Info Header */}
      <div className="space-y-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{job.company_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className="text-lg">{getCountryFlag(job.country_code)}</span>
              <MapPin className="w-3.5 h-3.5" />
              <span>{job.city}, {job.country_name}</span>
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

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Mail className="w-4 h-4 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate text-foreground">{job.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Phone className="w-4 h-4 text-blue-500" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Telefono</p>
              <p className="text-sm font-medium truncate text-foreground">{job.phone || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
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

      {/* Notes */}
      <div className="flex-1 space-y-2 mb-6">
        <label className="text-sm font-medium text-foreground">Note</label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Appunti sul contatto..."
          className="min-h-[120px] resize-none"
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
  );
}
