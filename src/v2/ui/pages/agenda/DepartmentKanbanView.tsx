/**
 * DepartmentKanbanView — Kanban "Reparti" per la sezione Agenda.
 *
 * Stessa estetica di ContactPipelineView (lifecycle clienti) ma sull'asse
 * "reparto" anziché "lead_status". Drag-and-drop sposta il job (`activities`)
 * fra le 5 colonne aggiornando `activities.department`.
 *
 * Allineato al doc Funnemail (cap. 18 + Appendice §18): un'unica agenda con
 * 4 reparti operativi + colonna "Da assegnare" per i job senza reparto.
 */
import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Truck, Receipt, Wrench, HelpCircle, GripVertical, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  findActivitiesForKanban,
  updateActivityDepartment,
  invalidateActivityCache,
  type KanbanJobCard,
  type ActivityDepartment,
} from "@/data/activities";

type ColumnId = ActivityDepartment | "unassigned";

interface ColumnDef {
  readonly id: ColumnId;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly colorClass: string;
  readonly bgClass: string;
  readonly borderClass: string;
}

const COLUMNS: readonly ColumnDef[] = [
  { id: "unassigned", label: "Da assegnare",     icon: <HelpCircle className="h-3.5 w-3.5" />, colorClass: "text-muted-foreground", bgClass: "bg-muted/30",       borderClass: "border-border/40" },
  { id: "commercial", label: "Commerciale",      icon: <Briefcase className="h-3.5 w-3.5" />,  colorClass: "text-blue-400",         bgClass: "bg-blue-500/10",    borderClass: "border-blue-500/20" },
  { id: "operations", label: "Operativo",        icon: <Truck className="h-3.5 w-3.5" />,      colorClass: "text-amber-400",        bgClass: "bg-amber-500/10",   borderClass: "border-amber-500/20" },
  { id: "admin",      label: "Amministrativo",   icon: <Receipt className="h-3.5 w-3.5" />,    colorClass: "text-indigo-400",       bgClass: "bg-indigo-500/10",  borderClass: "border-indigo-500/20" },
  { id: "general",    label: "Servizi Generali", icon: <Wrench className="h-3.5 w-3.5" />,     colorClass: "text-purple-400",       bgClass: "bg-purple-500/10",  borderClass: "border-purple-500/20" },
] as const;

function priorityBadge(p: string | null): { label: string; cls: string } | null {
  if (!p) return null;
  const v = p.toLowerCase();
  if (v === "high" || v === "p0" || v === "critical") return { label: "P0", cls: "bg-red-500/15 text-red-300 border-red-500/30" };
  if (v === "medium" || v === "p1") return { label: "P1", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  if (v === "low" || v === "p2") return { label: "P2", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
  return null;
}

function relativeDue(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "oggi";
  if (diffDays === 1) return "domani";
  if (diffDays === -1) return "ieri";
  if (diffDays < 0) return `${Math.abs(diffDays)}g fa`;
  return `+${diffDays}g`;
}

/**
 * Costruisce un titolo "parlante" per la card:
 * priorità a email_subject, poi description, poi title pulito da prefissi ripetitivi.
 */
function cardHeadline(j: KanbanJobCard): string {
  const subj = (j.email_subject || "").trim();
  if (subj) return subj;
  const desc = (j.description || "").trim().split("\n")[0];
  if (desc && desc.length > 4) return desc.slice(0, 120);
  const t = (j.title || "").replace(/^Risposta email:\s*/i, "").trim();
  return t || "(senza dettaglio)";
}

function cardKindLabel(j: KanbanJobCard): string {
  const t = (j.title || "").toLowerCase();
  if (t.startsWith("risposta email")) return "Risposta email";
  return j.activity_type.replace(/_/g, " ");
}

export function DepartmentKanbanView(): React.ReactElement {
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);
  const [detail, setDetail] = useState<KanbanJobCard | null>(null);

  const { data: jobs, isLoading } = useQuery({
    queryKey: queryKeys.activities.departmentKanban,
    queryFn: () => findActivitiesForKanban(500),
    staleTime: 30_000,
  });

  const moveMut = useMutation({
    mutationFn: ({ id, dept }: { id: string; dept: ActivityDepartment | null }) =>
      updateActivityDepartment(id, dept),
    onSuccess: () => {
      invalidateActivityCache(qc);
      qc.invalidateQueries({ queryKey: queryKeys.activities.departmentKanban });
    },
    onError: (e: Error) => toast.error(`Spostamento fallito: ${e.message}`),
  });

  const groups = useMemo(() => {
    const out: Record<ColumnId, KanbanJobCard[]> = {
      unassigned: [], commercial: [], operations: [], admin: [], general: [],
    };
    for (const j of jobs || []) {
      const key: ColumnId = j.department ?? "unassigned";
      out[key].push(j);
    }
    return out;
  }, [jobs]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverCol(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, col: ColumnId) => {
      e.preventDefault();
      setDragOverCol(null);
      if (!draggedId) return;
      const dept: ActivityDepartment | null = col === "unassigned" ? null : col;
      const job = (jobs || []).find((j) => j.id === draggedId);
      if (!job) { setDraggedId(null); return; }
      const current: ColumnId = job.department ?? "unassigned";
      if (current === col) { setDraggedId(null); return; }
      moveMut.mutate({ id: draggedId, dept });
      setDraggedId(null);
    },
    [draggedId, jobs, moveMut],
  );

  if (isLoading) {
    return (
      <div className="grid h-full grid-cols-5 gap-3 p-3">
        {COLUMNS.map((c) => (
          <Skeleton key={c.id} className="h-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto p-3">
      {COLUMNS.map((col) => {
        const items = groups[col.id];
        const isOver = dragOverCol === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border transition-all",
              col.borderClass,
              col.bgClass,
              isOver && "border-2 border-dashed ring-2 ring-primary/30",
            )}
          >
            <div className={cn("flex items-center gap-2 border-b px-3 py-2", col.borderClass)}>
              <span className={col.colorClass}>{col.icon}</span>
              <span className="text-sm font-semibold text-foreground">{col.label}</span>
              <Badge variant="outline" className="ml-auto text-xs">{items.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-2">
                {items.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground">Nessun job</div>
                ) : (
                  items.map((j) => {
                    const prio = priorityBadge(j.priority);
                    const due = relativeDue(j.due_date);
                    return (
                      <div
                        key={j.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, j.id)}
                        onClick={() => setDetail(j)}
                        className={cn(
                          "group cursor-grab rounded-md border border-border/60 bg-card p-2.5 text-sm shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
                          draggedId === j.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                              {cardKindLabel(j)}
                            </div>
                            <div className="line-clamp-2 font-medium text-foreground">
                              {cardHeadline(j)}
                            </div>
                            {j.partner_name && (
                              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                {j.partner_country ? `${j.partner_country} · ` : ""}{j.partner_name}
                              </div>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {prio && (
                                <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", prio.cls)}>
                                  {prio.label}
                                </span>
                              )}
                              {due && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <CalendarDays className="h-3 w-3" /> {due}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  {detail.email_subject || cardHeadline(detail)}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {cardKindLabel(detail)}
                  {detail.partner_name ? ` · ${detail.partner_name}` : ""}
                  {detail.partner_country ? ` (${detail.partner_country})` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Creato: {new Date(detail.created_at).toLocaleString("it-IT")}</span>
                  {detail.due_date && <span>Scadenza: {new Date(detail.due_date).toLocaleString("it-IT")}</span>}
                  {detail.scheduled_at && <span>Schedulato: {new Date(detail.scheduled_at).toLocaleString("it-IT")}</span>}
                  <span>Stato: {detail.status}</span>
                </div>

                {detail.description && (
                  <section>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrizione</h4>
                    <p className="whitespace-pre-line">{detail.description}</p>
                  </section>
                )}

                {detail.email_body && (
                  <section>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email originale</h4>
                    <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-xs">
                      {detail.email_body}
                    </pre>
                  </section>
                )}

                {!detail.description && !detail.email_body && (
                  <p className="text-xs italic text-muted-foreground">Nessun dettaglio aggiuntivo registrato per questo job.</p>
                )}

                {detail.partner_id && (
                  <a
                    href={`/v2/partner/${detail.partner_id}`}
                    className="inline-block text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Apri partner →
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DepartmentKanbanView;