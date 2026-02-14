import { useState } from "react";
import { Mail, Phone, MapPin, CheckCircle2, FileText, Calendar, Save, User, Users, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCountryFlag } from "@/lib/countries";
import { useUpdateCampaignJob, useEmailTemplates, type CampaignJob, type PartnerContact } from "@/hooks/useCampaignJobs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JobCanvasProps {
  job: CampaignJob | null;
  contacts?: PartnerContact[];
}

export function JobCanvas({ job, contacts = [] }: JobCanvasProps) {
  const updateJob = useUpdateCampaignJob();
  const { data: templates = [] } = useEmailTemplates();
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Sync notes when job changes
  if (job && job.id !== notesLoaded) {
    setNotes(job.notes || "");
    setNotesLoaded(job.id);
    setSelectedContacts([]);
    setSelectedTemplates([]);
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

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId) ? prev.filter(c => c !== contactId) : [...prev, contactId]
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
    <ScrollArea className="h-full">
      <div className="flex flex-col p-6 space-y-6">
        {/* Partner Info Header */}
        <div className="space-y-3">
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

        {/* Contacts Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              Contatti ({contacts.length})
            </h3>
            {selectedContacts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedContacts.length} selezionati
              </Badge>
            )}
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center bg-muted/30 rounded-lg border border-border">
              Nessun contatto disponibile per questa azienda
            </p>
          ) : (
            <div className="space-y-2">
              {contacts.map(contact => {
                const hasEmail = !!contact.email;
                const hasPhone = !!(contact.direct_phone || contact.mobile);
                return (
                  <div
                    key={contact.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      selectedContacts.includes(contact.id)
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                    onClick={() => toggleContact(contact.id)}
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm text-foreground truncate">{contact.name}</span>
                        {contact.is_primary && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Primario</Badge>
                        )}
                      </div>
                      {contact.title && (
                        <p className="text-xs text-muted-foreground ml-5.5">{contact.title}</p>
                      )}
                      <div className="flex items-center gap-3 ml-5.5 text-xs">
                        {contact.email ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Mail className="w-3 h-3" /> {contact.email}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground/50">
                            <Mail className="w-3 h-3" /> —
                          </span>
                        )}
                        {(contact.direct_phone || contact.mobile) ? (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Phone className="w-3 h-3" /> {contact.direct_phone || contact.mobile}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground/50">
                            <Phone className="w-3 h-3" /> —
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5", hasEmail ? "bg-emerald-500" : "bg-muted-foreground/20")} />
                      <div className={cn("w-2 h-2 rounded-full mt-1.5", hasPhone ? "bg-blue-500" : "bg-muted-foreground/20")} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
  );
}
