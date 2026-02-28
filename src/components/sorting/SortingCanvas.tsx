import { useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Send, X, Pencil, PackageCheck, Loader2 } from "lucide-react";
import { useReviewJob, useSendJob, useCancelJobs, useUpdateJobEmail } from "@/hooks/useSortingJobs";
import type { SortingJob } from "@/hooks/useSortingJobs";

interface SortingCanvasProps {
  job: SortingJob | null;
}

export function SortingCanvas({ job }: SortingCanvasProps) {
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const reviewMutation = useReviewJob();
  const sendMutation = useSendJob();
  const cancelMutation = useCancelJobs();
  const updateMutation = useUpdateJobEmail();

  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <PackageCheck className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">Seleziona un job dalla lista</p>
        </div>
      </div>
    );
  }

  const isSending = sendMutation.isPending;
  const contactEmail = job.selected_contact?.email;

  const startEdit = () => {
    setEditSubject(job.email_subject || "");
    setEditBody(job.email_body || "");
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({ id: job.id, email_subject: editSubject, email_body: editBody });
    setEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-1">
        <div className="flex items-center gap-2">
          <img
            src={`https://flagcdn.com/20x15/${(job.partners?.country_code || "").toLowerCase()}.png`}
            alt="" className="w-5 h-4 rounded-sm"
          />
          <span className="font-semibold">{job.partners?.company_alias || job.partners?.company_name}</span>
          {job.reviewed && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Rivisto
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {job.partners?.city}, {job.partners?.country_name} · {job.selected_contact?.contact_alias || job.selected_contact?.name || "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          A: <span className="font-mono">{contactEmail || "nessuna email"}</span>
        </div>
      </div>

      {/* Email preview */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {editing ? (
            <>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Oggetto" className="text-sm" />
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={16} className="text-sm font-mono" />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>Salva</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
              </div>
            </>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Oggetto:</span>
                <span className="ml-2 text-sm font-medium">{job.email_subject || "(senza oggetto)"}</span>
              </div>
              <div className="p-4 bg-background text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(job.email_body || "", { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'hr', 'blockquote', 'pre', 'code', 'b', 'i', 'u'], ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'style', 'class'] }) }} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border flex items-center gap-2 flex-wrap">
        {!job.reviewed && (
          <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: job.id, reviewed: true })} disabled={reviewMutation.isPending}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Approva
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={startEdit}>
          <Pencil className="w-4 h-4 mr-1" /> Modifica
        </Button>
        <Button
          size="sm"
          onClick={() => sendMutation.mutate(job)}
          disabled={isSending || !contactEmail || !job.reviewed}
          title={!job.reviewed ? "Approva prima di inviare" : ""}
        >
          {isSending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
          Invia ora
        </Button>
        <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate([job.id])} disabled={cancelMutation.isPending}>
          <X className="w-4 h-4 mr-1" /> Scarta
        </Button>
      </div>
    </div>
  );
}
