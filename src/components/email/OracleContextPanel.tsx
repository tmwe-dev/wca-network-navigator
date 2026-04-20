/**
 * OracleContextPanel — accordion that shows what Oracolo "knows" before/after generation.
 * Always visible (closed by default), powered by _context_summary returned by edges.
 */
import { useState } from "react";
import { ChevronDown, BookOpen, History, Thermometer, Search, Users, Briefcase, Settings as SettingsIcon, CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OracleContextSummary {
  kb_sections?: string[];
  history_present?: boolean;
  touch_count?: number;
  days_since_last_contact?: number | null;
  warmth_score?: number | null;
  commercial_state?: string | null;
  last_channel?: string | null;
  last_outcome?: string | null;
  deep_search_status?: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed" | string;
  deep_search_age_days?: number | null;
  playbook_active?: boolean;
  met_in_person?: boolean;
  documents_count?: number;
  sender_settings_ok?: boolean;
  oracle_type?: string | null;
  coherence_warning?: boolean;
  partner_loaded?: boolean;
  contact_loaded?: boolean;
}

interface Props {
  summary: OracleContextSummary | null;
  hasRecipient: boolean;
}

function formatWarmth(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score < 30) return `${score}/100 · Freddo`;
  if (score < 60) return `${score}/100 · Tiepido`;
  return `${score}/100 · Caldo`;
}

function formatDeepSearch(status: string | undefined, ageDays: number | null | undefined): { text: string; tone: "ok" | "warn" | "muted" } {
  switch (status) {
    case "fresh": return { text: ageDays != null ? `Aggiornata (${ageDays}gg fa)` : "Aggiornata", tone: "ok" };
    case "cached": return { text: ageDays != null ? `In cache (${ageDays}gg)` : "In cache", tone: "ok" };
    case "stale": return { text: ageDays != null ? `Vecchia (${ageDays}gg) — ricompila` : "Vecchia", tone: "warn" };
    case "missing": return { text: "Non disponibile — clicca 🔍 per cercare", tone: "muted" };
    case "failed": return { text: "Errore durante lo scrape", tone: "warn" };
    case "skipped": return { text: "Non richiesta", tone: "muted" };
    default: return { text: "—", tone: "muted" };
  }
}

export default function OracleContextPanel({ summary, hasRecipient }: Props) {
  const [open, setOpen] = useState(false);

  if (!hasRecipient && !summary) {
    return (
      <div className="rounded-md border border-border/30 bg-muted/10 px-2 py-1.5 text-[10px] text-muted-foreground flex items-center gap-1.5">
        <CircleAlert className="w-3 h-3" />
        Aggiungi un destinatario per vedere il contesto
      </div>
    );
  }

  const ds = formatDeepSearch(summary?.deep_search_status, summary?.deep_search_age_days);

  return (
    <div className="rounded-md border border-border/30 bg-muted/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-medium text-foreground/80 hover:bg-muted/30 transition-colors rounded-md"
      >
        <span className="flex items-center gap-1.5">
          <SettingsIcon className="w-3 h-3" />
          Cosa sa Oracolo
          {summary?.coherence_warning && (
            <span className="ml-1 px-1 py-0.5 rounded bg-warning/15 text-warning text-[9px]">⚠ Incoerenza</span>
          )}
        </span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border/30 px-2 py-1.5 space-y-1 text-[10px]">
          {!summary && (
            <p className="text-muted-foreground italic">Genera o migliora un'email per vedere il contesto attivo.</p>
          )}
          {summary && (
            <>
              <Row icon={<BookOpen className="w-3 h-3" />} label="KB sezioni">
                {summary.kb_sections?.length ? summary.kb_sections.join(", ") : "nessuna"}
              </Row>
              <Row icon={<History className="w-3 h-3" />} label="Storia">
                {summary.touch_count
                  ? `${summary.touch_count} interazioni · ${summary.days_since_last_contact ?? "?"}gg fa · ${summary.last_channel ?? "?"}${summary.last_outcome ? ` · ${summary.last_outcome}` : ""}`
                  : "Prima interazione"}
              </Row>
              <Row icon={<Thermometer className="w-3 h-3" />} label="Calore">
                {formatWarmth(summary.warmth_score)} {summary.commercial_state ? `· ${summary.commercial_state}` : ""}
              </Row>
              <Row icon={<Search className="w-3 h-3" />} label="Deep Search" tone={ds.tone}>
                {ds.text}
              </Row>
              {summary.met_in_person && (
                <Row icon={<Users className="w-3 h-3" />} label="Incontri">Met in person ✓</Row>
              )}
              {summary.playbook_active && (
                <Row icon={<Briefcase className="w-3 h-3" />} label="Playbook" tone="ok">Attivo</Row>
              )}
              <Row icon={summary.sender_settings_ok ? <CircleCheck className="w-3 h-3" /> : <CircleAlert className="w-3 h-3" />} label="Mittente" tone={summary.sender_settings_ok ? "ok" : "warn"}>
                {summary.sender_settings_ok ? "Configurato" : "Manca alias/azienda"}
              </Row>
              {summary.oracle_type && (
                <Row icon={<SettingsIcon className="w-3 h-3" />} label="Tipo">{summary.oracle_type}</Row>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, children, tone = "muted" }: { icon: React.ReactNode; label: string; children: React.ReactNode; tone?: "ok" | "warn" | "muted" }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={cn(
        "shrink-0 mt-[1px]",
        tone === "ok" && "text-success",
        tone === "warn" && "text-warning",
        tone === "muted" && "text-muted-foreground",
      )}>{icon}</span>
      <span className="text-muted-foreground/70 shrink-0">{label}:</span>
      <span className={cn(
        "text-foreground/80",
        tone === "warn" && "text-warning",
      )}>{children}</span>
    </div>
  );
}
