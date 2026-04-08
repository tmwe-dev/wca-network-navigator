/**
 * Staff Direzionale — virtual C-level dashboard.
 *
 * Surfaces Margot (COO), Sage (Strategist), Atlas (Researcher), Mira (Controller).
 * They are async strategists that report only to Luca via ai_session_briefings.
 * This page reads their playbooks from commercial_playbooks (staff_*) and shows
 * the latest briefings filtered by tag.
 *
 * Backend: see migration 20260408095954_wave6_hardening_telemetry_staff.sql
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTrackPage } from "@/hooks/useTrackPage";

interface StaffPlaybook {
  id: string;
  code: string;
  name: string;
  description: string | null;
  prompt_template: string | null;
  kb_tags: string[] | null;
  trigger_conditions: any;
  priority: number;
}

interface BriefingRow {
  id: string;
  briefing: string;
  scope: string;
  scope_id: string | null;
  active: boolean;
  created_at: string;
  expires_at: string | null;
}

const STAFF_VISUAL: Record<
  string,
  { initial: string; gradient: string; role: string; emoji: string }
> = {
  staff_margot_coo: {
    initial: "M",
    gradient: "from-rose-500 to-pink-600",
    role: "COO virtuale",
    emoji: "🎯",
  },
  staff_sage_strategist: {
    initial: "S",
    gradient: "from-violet-500 to-indigo-600",
    role: "Strategist",
    emoji: "🧭",
  },
  staff_atlas_researcher: {
    initial: "A",
    gradient: "from-emerald-500 to-teal-600",
    role: "Researcher",
    emoji: "🔍",
  },
  staff_mira_controller: {
    initial: "M",
    gradient: "from-amber-500 to-orange-600",
    role: "Controller",
    emoji: "⚖️",
  },
};

export default function StaffDirezionale() {
  useTrackPage("staff_direzionale");

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff-direzionale-playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_playbooks" as any)
        .select("id, code, name, description, prompt_template, kb_tags, trigger_conditions, priority")
        .like("code", "staff_%")
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StaffPlaybook[];
    },
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Staff Direzionale</h1>
        <p className="text-xs text-slate-500">
          Azienda virtuale TMWE — i 4 consulenti AI che lavorano per te in autonomia
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && <div className="text-sm text-slate-500">Carico…</div>}

        {!isLoading && (!staff || staff.length === 0) && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="text-5xl mb-3">👥</div>
            <div className="text-sm font-medium">Lo staff direzionale non è ancora attivo</div>
            <div className="text-xs text-slate-500 mt-1">
              Applica la migration Wave 6 (20260408095954_wave6_hardening_telemetry_staff.sql)
              per instanziare Margot, Sage, Atlas e Mira.
            </div>
          </div>
        )}

        {staff && staff.length > 0 && (
          <div className="max-w-5xl space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Riportano <b>solo a te</b>. Mai a clienti, partner o operatori.
              Comunicano in modo asincrono via briefing e knowledge base.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.map((s) => (
                <StaffCard key={s.id} staff={s} />
              ))}
            </div>

            <BriefingsSection />
          </div>
        )}
      </div>
    </div>
  );
}

function StaffCard({ staff }: { staff: StaffPlaybook }) {
  const v = STAFF_VISUAL[staff.code] ?? {
    initial: "?",
    gradient: "from-slate-500 to-slate-700",
    role: "Agente",
    emoji: "🤖",
  };
  const schedule = staff.trigger_conditions?.schedule ?? "on demand";

  return (
    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${v.gradient} grid place-items-center text-white text-xl font-bold shrink-0`}
        >
          {v.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{staff.name}</div>
          <div className="text-xs text-slate-500">{v.role}</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          attivo
        </span>
      </div>

      {staff.description && (
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{staff.description}</p>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>📅 {schedule}</span>
        <span>{staff.kb_tags?.length ?? 0} KB tag</span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
        <button className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
          Vedi briefing
        </button>
        <button className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
          Configura
        </button>
      </div>
    </div>
  );
}

function BriefingsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["staff-direzionale-briefings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_session_briefings" as any)
        .select("id, briefing, scope, scope_id, active, created_at, expires_at")
        .eq("scope", "global")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as BriefingRow[];
    },
  });

  return (
    <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase font-semibold text-slate-400">
        Ultimi briefing per Luca
      </div>
      <div className="p-4">
        {isLoading && <div className="text-xs text-slate-500">Carico…</div>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="text-xs text-slate-500">
            Nessun briefing ancora. Quando lo staff scriverà a Luca, vedrai gli aggiornamenti qui.
          </div>
        )}
        {data && data.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((b) => (
              <li key={b.id} className="py-2.5">
                <div className="text-xs text-slate-400 mb-1">
                  {new Date(b.created_at).toLocaleString("it-IT")}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {b.briefing}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
