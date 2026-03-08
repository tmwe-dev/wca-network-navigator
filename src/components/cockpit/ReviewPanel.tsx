import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Search, CheckCircle2, Send, X, Pencil, PackageCheck, Loader2,
  User, Building2, Mail, Clock, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import {
  useSortingJobs, useReviewJob, useBulkReview,
  useCancelJobs, useSendJob, useUpdateJobEmail,
  type SortingJob,
} from "@/hooks/useSortingJobs";
import { groupByCountry } from "@/lib/groupByCountry";
import { isToday, parseISO } from "date-fns";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p","br","strong","em","ul","ol","li","a","h1","h2","h3","h4","div","span","table","tr","td","th","thead","tbody","img","hr","blockquote","pre","code","b","i","u"],
  ALLOWED_ATTR: ["href","target","src","alt","style","class"],
};

function ensureHtml(raw: string): string {
  if (!raw) return "";
  if (/<(p|br|div|ul|ol|h[1-6])\b/i.test(raw)) return raw;
  return raw.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n");
}

type FilterMode = "all" | "unreviewed" | "reviewed" | "today";

export function ReviewPanel() {
  const { data: jobs = [], isLoading } = useSortingJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });

  const reviewJob = useReviewJob();
  const bulkReview = useBulkReview();
  const cancelJobs = useCancelJobs();
  const sendJob = useSendJob();
  const updateEmail = useUpdateJobEmail();

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedId) || null, [jobs, selectedId]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (filter === "unreviewed") list = list.filter(j => !j.reviewed);
    if (filter === "reviewed") list = list.filter(j => j.reviewed);
    if (filter === "today") list = list.filter(j => j.scheduled_at && isToday(parseISO(j.scheduled_at)));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(j =>
        (j.partners?.company_name || "").toLowerCase().includes(q) ||
        (j.partners?.company_alias || "").toLowerCase().includes(q) ||
        (j.selected_contact?.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filter, search]);

  const groups = useMemo(
    () => groupByCountry(filtered, j => j.partners?.country_code || "??", j => j.partners?.country_name || ""),
    [filtered]
  );

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const checkedReviewed = useMemo(() => jobs.filter(j => checkedIds.has(j.id) && j.reviewed), [jobs, checkedIds]);

  const handleBulkSend = useCallback(async () => {
    if (!checkedReviewed.length) return;
    setSending(true);
    setSendProgress({ done: 0, total: checkedReviewed.length });
    for (let i = 0; i < checkedReviewed.length; i++) {
      try { await sendJob.mutateAsync(checkedReviewed[i]); } catch {}
      setSendProgress({ done: i + 1, total: checkedReviewed.length });
    }
    setSending(false);
    setCheckedIds(new Set());
  }, [checkedReviewed, sendJob]);

  const startEdit = () => {
    if (!selectedJob) return;
    setEditSubject(selectedJob.email_subject || "");
    setEditBody(selectedJob.email_body || "");
    setEditing(true);
  };

  const saveEdit = () => {
    if (!selectedJob) return;
    updateEmail.mutate({ id: selectedJob.id, email_subject: editSubject, email_body: editBody });
    setEditing(false);
  };

  const reviewedCount = jobs.filter(j => j.reviewed).length;
  const filterButtons: { key: FilterMode; label: string }[] = [
    { key: "all", label: "Tutti" },
    { key: "unreviewed", label: "Da rivedere" },
    { key: "reviewed", label: "Rivisti" },
    { key: "today", label: "Oggi" },
  ];

  return (
    <div className="flex h-full">
      {/* Left: Job list */}
      <div className="w-[320px] flex-shrink-0 border-r border-border/50 flex flex-col">
        <div className="px-3 pt-3 pb-2 space-y-2">
          <div className="text-xs text-muted-foreground">
            {jobs.length} in coda · {reviewedCount} rivisti
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-card/60 border-border/60"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {filterButtons.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                  filter === f.key
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 text-[11px]">
            <button onClick={() => setCheckedIds(new Set(jobs.map(j => j.id)))} className="text-primary hover:underline">Tutti</button>
            <button onClick={() => setCheckedIds(new Set())} className="text-muted-foreground hover:underline">Nessuno</button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-4 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">Caricamento...</div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <PackageCheck className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nessun job in coda</p>
              </div>
            ) : (
              groups.map(g => (
                <div key={g.countryCode}>
                  <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <img src={`https://flagcdn.com/16x12/${g.countryCode.toLowerCase()}.png`} alt="" className="w-4 h-3 rounded-sm" />
                    {g.countryName} ({g.items.length})
                  </div>
                  {g.items.map(job => (
                    <div
                      key={job.id}
                      onClick={() => { setSelectedId(job.id); setEditing(false); }}
                      className={cn(
                        "flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150",
                        selectedId === job.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-card/60 border border-transparent"
                      )}
                    >
                      <Checkbox
                        checked={checkedIds.has(job.id)}
                        onCheckedChange={() => toggleCheck(job.id)}
                        onClick={e => e.stopPropagation()}
                        className="mt-0.5 h-3.5 w-3.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate text-foreground">
                          {job.partners?.company_alias || job.partners?.company_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {job.selected_contact?.contact_alias || job.selected_contact?.name || "—"}
                        </div>
                        {job.email_subject && (
                          <div className="text-[10px] text-muted-foreground/60 truncate mt-0.5">✉ {job.email_subject}</div>
                        )}
                      </div>
                      {job.reviewed && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Email preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedJob ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <PackageCheck className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Seleziona un job dalla lista</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3">
              <img
                src={`https://flagcdn.com/20x15/${(selectedJob.partners?.country_code || "").toLowerCase()}.png`}
                alt="" className="w-5 h-4 rounded-sm"
              />
              <span className="text-sm font-semibold truncate text-foreground">
                {selectedJob.partners?.company_alias || selectedJob.partners?.company_name}
              </span>
              {selectedJob.reviewed && (
                <Badge variant="outline" className="text-success border-success/30 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Rivisto
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {editing ? (
                  <div className="space-y-3 max-w-[640px] mx-auto">
                    <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Oggetto" className="text-sm" />
                    <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={16} className="text-sm font-mono" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={updateEmail.isPending}>Salva</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[640px] mx-auto">
                    {/* Email envelope */}
                    <div className="rounded-t-lg border border-border/60 bg-card/40 backdrop-blur-sm px-5 py-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="font-medium text-foreground">
                          {selectedJob.partners?.company_alias || selectedJob.partners?.company_name}
                        </span>
                        <span>· {selectedJob.partners?.city}, {selectedJob.partners?.country_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>{selectedJob.selected_contact?.contact_alias || selectedJob.selected_contact?.name || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        <span className="font-mono text-primary">{selectedJob.selected_contact?.email || "nessuna email"}</span>
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="border-x border-border/60 bg-card/20 px-5 py-2.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Oggetto</span>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">{selectedJob.email_subject || "(senza oggetto)"}</p>
                    </div>

                    {/* Body */}
                    <div
                      className="border border-border/60 rounded-b-lg bg-background px-6 py-5 text-sm leading-relaxed text-foreground/90 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:mb-3 [&_li]:mb-1 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
                      style={{ fontFamily: "'Georgia', serif" }}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ensureHtml(selectedJob.email_body || ""), SANITIZE_CONFIG) }}
                    />
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-2 flex-wrap">
              {!selectedJob.reviewed && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => reviewJob.mutate({ id: selectedJob.id, reviewed: true })}
                  disabled={reviewJob.isPending}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approva
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Modifica
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => sendJob.mutate(selectedJob)}
                disabled={sendJob.isPending || !selectedJob.selected_contact?.email || !selectedJob.reviewed}
              >
                {sendJob.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Invia
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5"
                onClick={() => cancelJobs.mutate([selectedJob.id])}
                disabled={cancelJobs.isPending}
              >
                <X className="w-3.5 h-3.5" /> Scarta
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Batch bar */}
      <AnimatePresence>
        {checkedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 border-t border-border/50 bg-card/90 backdrop-blur-xl px-4 py-2.5 flex items-center gap-3"
          >
            <span className="text-xs font-medium text-foreground">{checkedIds.size} selezionati</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
              onClick={() => bulkReview.mutate(Array.from(checkedIds))}
              disabled={bulkReview.isPending}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approva
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"
              onClick={handleBulkSend}
              disabled={sending || !checkedReviewed.length}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Invia ({checkedReviewed.length})
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5"
              onClick={() => { cancelJobs.mutate(Array.from(checkedIds)); setCheckedIds(new Set()); }}
              disabled={cancelJobs.isPending}
            >
              <X className="w-3.5 h-3.5" /> Scarta
            </Button>
            {sending && (
              <div className="flex-1 max-w-xs flex items-center gap-2">
                <Progress value={(sendProgress.done / sendProgress.total) * 100} className="h-1.5" />
                <span className="text-[10px] text-muted-foreground">{sendProgress.done}/{sendProgress.total}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
