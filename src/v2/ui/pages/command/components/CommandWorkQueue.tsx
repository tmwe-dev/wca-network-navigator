/**
 * CommandWorkQueue — sidebar agenda dei lavori aperti del Direttore.
 * Pattern ispirato a swiftpack-studio's WorkQueue: ogni job ha titolo,
 * fase corrente, badge stato e età. Click → emette evento di "ripresa".
 */
import { motion } from "framer-motion";
import { Briefcase, CheckCircle2, Clock, Pause, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import type { CommandJob, CommandJobPhase, CommandJobStatus } from "@/v2/io/supabase/queries/command-jobs";

interface Props {
  jobs: CommandJob[];
  loading: boolean;
  activeJobId: string | null;
  onResume: (job: CommandJob) => void;
  onArchive: (jobId: string) => void;
}

function ageLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

const STATUS_META: Record<CommandJobStatus, { color: string; label: string; Icon: typeof Clock }> = {
  open:               { color: "text-sky-300/80",     label: "Aperto",       Icon: Briefcase },
  in_progress:        { color: "text-amber-300/90",   label: "In corso",     Icon: Loader2 },
  awaiting_approval:  { color: "text-yellow-300/90",  label: "Approvazione", Icon: AlertTriangle },
  paused:             { color: "text-muted-foreground/70", label: "In pausa", Icon: Pause },
  done:               { color: "text-emerald-400/90", label: "Completato",   Icon: CheckCircle2 },
  error:              { color: "text-rose-400/90",    label: "Errore",       Icon: AlertTriangle },
  cancelled:          { color: "text-muted-foreground/50", label: "Annullato", Icon: Trash2 },
};

const PHASE_LABEL: Record<CommandJobPhase, string> = {
  discovery:          "Scoperta",
  planning:           "Pianificazione",
  awaiting_approval:  "In approvazione",
  executing:          "Esecuzione",
  review:             "Revisione",
  done:               "Concluso",
};

export default function CommandWorkQueue({ jobs, loading, activeJobId, onResume, onArchive }: Props) {
  return (
    <div className="px-3 pt-2 pb-4 border-b border-white/[0.06]">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 font-light">
          Agenda lavori
        </h3>
        <span className="text-[9px] text-muted-foreground/40 font-mono">{jobs.length}</span>
      </div>

      {loading && jobs.length === 0 ? (
        <div className="px-3 py-4 text-[10px] text-muted-foreground/40 font-light">
          Carico…
        </div>
      ) : jobs.length === 0 ? (
        <div className="px-3 py-4 text-[10px] text-muted-foreground/40 font-light leading-relaxed">
          Nessun lavoro aperto.<br />
          Quando dai un obiettivo articolato (es. "trovare partner di Malta e invitarli"), lo trovi qui.
        </div>
      ) : (
        <div className="space-y-1">
          {jobs.map((job) => {
            const meta = STATUS_META[job.status];
            const Icon = meta.Icon;
            const active = job.id === activeJobId;
            return (
              <motion.div
                key={job.id}
                whileHover={{ x: 2 }}
                onClick={() => onResume(job)}
                className={`group relative flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                  active
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <Icon
                  className={`w-3 h-3 mt-0.5 flex-shrink-0 ${meta.color} ${
                    job.status === "in_progress" ? "animate-spin" : ""
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] truncate font-light ${active ? "text-foreground/95" : "text-foreground/75"}`}>
                    {job.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-mono ${meta.color}`}>{meta.label}</span>
                    <span className="text-[9px] text-muted-foreground/30">·</span>
                    <span className="text-[9px] text-muted-foreground/50 font-light">
                      {PHASE_LABEL[job.phase]}
                    </span>
                    <span className="text-[9px] text-muted-foreground/30">·</span>
                    <span className="text-[9px] text-muted-foreground/40 font-mono">
                      {ageLabel(job.last_activity_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(job.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                  title="Annulla lavoro"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground/50" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}