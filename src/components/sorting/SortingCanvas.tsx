import { useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Send, X, Pencil, PackageCheck, Loader2, User, Building2, Mail } from "lucide-react";
import { useReviewJob, useSendJob, useCancelJobs, useUpdateJobEmail } from "@/hooks/useSortingJobs";
import type { SortingJob } from "@/hooks/useSortingJobs";

interface SortingCanvasProps {
  job: SortingJob | null;
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'hr', 'blockquote', 'pre', 'code', 'b', 'i', 'u'],
  ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'style', 'class'],
};

/** Ensure legacy plain-text bodies get converted to HTML */
function ensureHtml(raw: string): string {
  if (!raw) return "";
  // If already contains HTML block tags, return as-is
  if (/<(p|br|div|ul|ol|h[1-6])\b/i.test(raw)) return raw;
  // Convert plain text: double newlines → paragraphs, single → <br>
  return raw
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
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
  const contactName = job.selected_contact?.contact_alias || job.selected_contact?.name || "—";
  const companyName = job.partners?.company_alias || job.partners?.company_name || "—";

  const startEdit = () => {
    setEditSubject(job.email_subject || "");
    setEditBody(job.email_body || "");
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({ id: job.id, email_subject: editSubject, email_body: editBody });
    setEditing(false);
  };

  const sanitizedBody = DOMPurify.sanitize(ensureHtml(job.email_body || ""), SANITIZE_CONFIG);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Compact header bar */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 bg-muted/30">
        <img
          src={`https://flagcdn.com/20x15/${(job.partners?.country_code || "").toLowerCase()}.png`}
          alt="" className="w-5 h-4 rounded-sm shrink-0"
        />
        <span className="font-semibold text-sm truncate">{companyName}</span>
        {job.reviewed && (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs shrink-0">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Rivisto
          </Badge>
        )}
      </div>

      {/* Email client preview */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {editing ? (
            <div className="space-y-3">
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Oggetto" className="text-sm" />
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={16} className="text-sm font-mono" />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>Salva</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
              </div>
            </div>
          ) : (
            <div className="max-w-[640px] mx-auto">
              {/* Email envelope header */}
              <div className="rounded-t-lg border border-border bg-muted/40 px-5 py-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{companyName}</span>
                  <span>· {job.partners?.city}, {job.partners?.country_name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>{contactName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                   <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                   <span className="font-mono text-muted-foreground">{contactEmail || "nessuna email"}</span>
                </div>
              </div>

              {/* Subject bar */}
              <div className="border-x border-border bg-muted/20 px-5 py-2.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Oggetto</span>
                <p className="text-sm font-semibold mt-0.5">{job.email_subject || "(senza oggetto)"}</p>
              </div>

              {/* Email body — white bg, professional typography */}
              <div
                className="border border-border rounded-b-lg bg-card px-6 py-5 text-sm leading-relaxed text-foreground/80 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:mb-3 [&_li]:mb-1 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_br]:leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:my-4 [&_hr]:border-muted"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                dangerouslySetInnerHTML={{ __html: sanitizedBody }}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-3 border-t border-border flex items-center gap-2 flex-wrap">
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
