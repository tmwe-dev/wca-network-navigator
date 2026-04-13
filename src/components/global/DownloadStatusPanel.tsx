import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, X, Download, Mail, Phone, Users } from "lucide-react";
import { useDownloadJobs, usePauseResumeJob } from "@/hooks/useDownloadJobs";
import { Progress } from "@/components/ui/progress";

function countryFlag(code: string) {
  if (!code || code.length < 2) return "🏳️";
  const upper = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function DownloadStatusPanel({ onActiveCountry }: { onActiveCountry?: (code: string | null) => void }) {
  const { data: jobs = [] } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();

  const activeJob = useMemo(() => jobs.find((j) => j.status === "running" || j.status === "pending"), [jobs]);
  const completedJobs = useMemo(() => jobs.filter((j) => j.status === "completed"), [jobs]);
  const queuedJobs = useMemo(() => jobs.filter((j) => j.status === "pending" && j.id !== activeJob?.id), [jobs, activeJob]);

  useMemo(() => {
    onActiveCountry?.(activeJob?.country_code || null);
  }, [activeJob?.country_code, onActiveCountry]);

  const totals = useMemo(() => jobs.reduce(
    (acc, j) => ({ processed: acc.processed + j.current_index, emails: acc.emails + j.contacts_found_count, phones: acc.phones + j.contacts_missing_count }),
    { processed: 0, emails: 0, phones: 0 }
  ), [jobs]);

  const progress = activeJob ? Math.round((activeJob.current_index / Math.max(activeJob.total_count, 1)) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Processati" value={totals.processed} />
        <StatCard icon={<Mail className="w-3.5 h-3.5" />} label="Contatti" value={totals.emails} />
        <StatCard icon={<Phone className="w-3.5 h-3.5" />} label="Mancanti" value={totals.phones} />
      </div>

      {activeJob && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{countryFlag(activeJob.country_code)}</span>
              <div>
                <p className="text-xs font-medium text-white">{activeJob.country_name}</p>
                <p className="text-[10px] text-slate-400">{activeJob.current_index}/{activeJob.total_count} • {activeJob.last_processed_company || "In attesa..."}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => pauseResume.mutate({ jobId: activeJob.id, action: activeJob.status === "running" ? "pause" : "resume" })} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                {activeJob.status === "running" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => pauseResume.mutate({ jobId: activeJob.id, action: "cancel" })} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <Progress value={progress} className="h-1.5 bg-white/5" />
          <p className="text-[10px] text-right text-slate-500">{progress}%</p>
        </div>
      )}

      {queuedJobs.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-1">In coda ({queuedJobs.length})</p>
          {queuedJobs.slice(0, 3).map((j) => (
            <div key={j.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] text-xs text-slate-400">
              <span>{countryFlag(j.country_code)}</span>
              <span className="flex-1 truncate">{j.country_name}</span>
              <span className="text-[10px] text-slate-600">{j.total_count}</span>
            </div>
          ))}
        </div>
      )}

      {completedJobs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-1">Completati ({completedJobs.length})</p>
          <div className="flex flex-wrap gap-1">
            <AnimatePresence>
              {completedJobs.map((j) => (
                <motion.div key={j.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                  <span>{countryFlag(j.country_code)}</span><span>{j.country_code}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Download className="w-8 h-8 text-white/10" />
          <p className="text-[10px] text-slate-600 text-center">Nessun download attivo.<br />Chiedi all'assistente di avviarne uno.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg bg-white/[0.03] border border-white/5">
      <div className="text-slate-500">{icon}</div>
      <p className="text-sm font-semibold text-white tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[9px] text-slate-500">{label}</p>
    </div>
  );
}
