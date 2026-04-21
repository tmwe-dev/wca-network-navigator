/**
 * ContextSummary (LOVABLE-83) — Mostra all'utente cosa l'AI sa/ha usato.
 * Modalità compact (pillole inline pre/post generazione) ed expanded (pannello 3 colonne).
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen, Brain, Search, MessageSquare, User, FileText,
  CircleCheck, CircleAlert, AlertTriangle,
} from "lucide-react";
import type { ResolvedEmailType } from "../types/contract";

export interface PreGenerationContext {
  partner: { name: string; status: string; country?: string | null };
  contact?: { name: string; role?: string | null };
  relationship: {
    touch_count: number;
    has_replied: boolean;
    days_since_last: number | null;
    last_channel?: string | null;
  };
  enrichment: { base: boolean; deep_search: boolean; sherlock: boolean; last_enriched?: string };
  kb: { sections_available: string[]; playbook_active?: string; playbook_step?: number };
  memory: { count: number; summary?: string };
  style: { language: string; tone?: string };
  type_resolution?: ResolvedEmailType | null;
}

export interface PostGenerationContext {
  kb_sections_used: string[];
  enrichment_used: string[];
  memories_used: number;
  history_used: boolean;
  playbook_used: boolean;
  journalist?: { role: string; verdict: string; score: number };
  warnings: string[];
}

interface Props {
  preContext?: PreGenerationContext;
  postContext?: PostGenerationContext;
  mode: "compact" | "expanded";
}

export function ContextSummary({ preContext, postContext, mode }: Props): React.ReactElement | null {
  if (!preContext) return null;
  return mode === "compact"
    ? <CompactSummary pre={preContext} post={postContext} />
    : <ExpandedSummary pre={preContext} post={postContext} />;
}

function Pill({ icon: Icon, label, status }: {
  icon: React.ElementType; label: string;
  status: "active" | "empty" | "warning" | "error";
}) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
      status === "active" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      status === "empty" && "bg-card/40 text-foreground/40 border-border/40",
      status === "warning" && "bg-amber-500/10 text-amber-300 border-amber-500/30",
      status === "error" && "bg-red-500/10 text-red-300 border-red-500/30",
    )}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </div>
  );
}

function CompactSummary({ pre, post }: { pre: PreGenerationContext; post?: PostGenerationContext }) {
  const enrichLevels = [pre.enrichment.base, pre.enrichment.deep_search, pre.enrichment.sherlock].filter(Boolean).length;
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
      <Pill icon={User} label={`${pre.partner.name} · ${pre.partner.status}`} status="active" />
      <Pill icon={MessageSquare}
        label={`${pre.relationship.touch_count} msg ${pre.relationship.has_replied ? "↔" : "→"}`}
        status={pre.relationship.touch_count > 0 ? "active" : "empty"} />
      <Pill icon={Search}
        label={enrichLevels > 0 ? `Enrich ×${enrichLevels}` : "No enrich"}
        status={enrichLevels > 0 ? "active" : "warning"} />
      <Pill icon={BookOpen}
        label={`${pre.kb.sections_available.length} KB`}
        status={pre.kb.sections_available.length > 0 ? "active" : "warning"} />
      <Pill icon={Brain}
        label={`${pre.memory.count} mem`}
        status={pre.memory.count > 0 ? "active" : "empty"} />
      {pre.type_resolution?.was_overridden && (
        <Pill icon={AlertTriangle} label={`Tipo → ${pre.type_resolution.resolved_type}`} status="warning" />
      )}
      {post?.journalist && (
        <Pill icon={FileText} label={`${post.journalist.role} · ${post.journalist.verdict}`}
          status={post.journalist.verdict === "block" ? "error" :
            post.journalist.verdict === "warn" ? "warning" : "active"} />
      )}
      {post && post.warnings.length > 0 && (
        <Pill icon={AlertTriangle} label={`${post.warnings.length} warn`} status="warning" />
      )}
    </div>
  );
}

function ExpandedSummary({ pre, post }: { pre: PreGenerationContext; post?: PostGenerationContext }) {
  type Item = { label: string; value: string; status: "ok" | "missing" };
  const Section = ({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: Item[] }) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
        <Icon className="h-3 w-3" />{title}
      </div>
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-[10px]">
            <span className="text-foreground/50">{it.label}</span>
            <span className={cn("text-right truncate", it.status === "ok" ? "text-foreground/90" : "text-foreground/30 italic")}>
              {it.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
        {post ? "Contesto usato dall'AI" : "Contesto disponibile per l'AI"}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Section icon={User} title="Destinatario + Relazione" items={[
          { label: "Partner", value: pre.partner.name, status: "ok" },
          { label: "Stato", value: pre.partner.status, status: "ok" },
          { label: "Paese", value: pre.partner.country || "—", status: pre.partner.country ? "ok" : "missing" },
          { label: "Touch count", value: String(pre.relationship.touch_count), status: pre.relationship.touch_count > 0 ? "ok" : "missing" },
          { label: "Ha risposto", value: pre.relationship.has_replied ? "Sì" : "No", status: pre.relationship.has_replied ? "ok" : "missing" },
          { label: "Ultimo contatto", value: pre.relationship.days_since_last !== null ? `${pre.relationship.days_since_last} gg fa` : "Mai", status: pre.relationship.days_since_last !== null ? "ok" : "missing" },
        ]} />
        <Section icon={Search} title="Enrichment + Memory" items={[
          { label: "Base", value: pre.enrichment.base ? "Sì" : "No", status: pre.enrichment.base ? "ok" : "missing" },
          { label: "Deep Search", value: pre.enrichment.deep_search ? "Sì" : "No", status: pre.enrichment.deep_search ? "ok" : "missing" },
          { label: "Sherlock", value: pre.enrichment.sherlock ? "Sì" : "No", status: pre.enrichment.sherlock ? "ok" : "missing" },
          { label: "Memorie", value: String(pre.memory.count), status: pre.memory.count > 0 ? "ok" : "missing" },
        ]} />
        <Section icon={BookOpen} title="KB + Stile" items={[
          { label: "Sezioni KB", value: pre.kb.sections_available.length > 0 ? pre.kb.sections_available.join(", ") : "Nessuna", status: pre.kb.sections_available.length > 0 ? "ok" : "missing" },
          ...(pre.kb.playbook_active ? [
            { label: "Playbook", value: pre.kb.playbook_active, status: "ok" as const },
            { label: "Step", value: String(pre.kb.playbook_step ?? "?"), status: "ok" as const },
          ] : []),
          { label: "Lingua", value: pre.style.language, status: "ok" },
          { label: "Tono", value: pre.style.tone || "default", status: pre.style.tone ? "ok" : "missing" },
        ]} />
      </div>

      {pre.type_resolution && pre.type_resolution.conflicts.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/40">
          <div className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Detector tipo email
          </div>
          {pre.type_resolution.conflicts.map((c, i) => (
            <div key={i} className={cn(
              "text-[10px] px-2 py-1 rounded border",
              c.severity === "blocking" && "bg-red-500/10 border-red-500/30 text-red-200",
              c.severity === "warning" && "bg-amber-500/10 border-amber-500/30 text-amber-200",
              c.severity === "info" && "bg-blue-500/10 border-blue-500/30 text-blue-200",
            )}>
              <div><span className="font-mono opacity-60">[{c.type}]</span> {c.description}</div>
              <div className="opacity-70 italic mt-0.5">→ {c.suggestion}</div>
            </div>
          ))}
        </div>
      )}

      {post && post.warnings.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/40">
          <div className="text-[10px] font-semibold text-amber-300 flex items-center gap-1">
            <CircleAlert className="h-3 w-3" /> Avvisi contratto
          </div>
          {post.warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-amber-200/80">⚠ {w}</div>
          ))}
        </div>
      )}

      {post && post.warnings.length === 0 && pre.type_resolution?.proceed && (
        <div className="pt-1 text-[10px] text-emerald-400/70 flex items-center gap-1">
          <CircleCheck className="h-3 w-3" /> Contesto coerente, nessuna segnalazione
        </div>
      )}
    </div>
  );
}