/**
 * FindingsView — visualizzazione leggibile dei findings AI di Sherlock.
 * Sostituisce il dump JSON crudo con card semantiche + toggle "Vedi JSON".
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Code2, Eye, MapPin, Phone, Mail, Globe, User, Building2, Sparkles } from "lucide-react";

interface Props {
  findings: Record<string, unknown>;
  suggestedNextUrl?: string | null;
  onInvestigateUrl?: (url: string) => void;
}

const ICON_BY_KEY: Array<{ test: RegExp; icon: React.ReactNode; label?: string }> = [
  { test: /address|indirizzo|location|sede/i, icon: <MapPin className="w-3.5 h-3.5" /> },
  { test: /phone|telefono|tel|mobile|cell/i, icon: <Phone className="w-3.5 h-3.5" /> },
  { test: /email|mail|pec/i, icon: <Mail className="w-3.5 h-3.5" /> },
  { test: /website|sito|url|domain/i, icon: <Globe className="w-3.5 h-3.5" /> },
  { test: /person|name|nome|contact|ceo|owner|director/i, icon: <User className="w-3.5 h-3.5" /> },
  { test: /company|azienda|business|brand/i, icon: <Building2 className="w-3.5 h-3.5" /> },
];

function iconFor(key: string): React.ReactNode {
  const m = ICON_BY_KEY.find((i) => i.test.test(key));
  return m?.icon ?? <Sparkles className="w-3.5 h-3.5" />;
}

function humanizeKey(key: string): string {
  return key
    .replace(/^_+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground italic">—</span>;
  if (typeof v === "string") {
    // Linkify URL, email, telefono
    if (/^https?:\/\//i.test(v)) {
      return (
        <a href={v} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
          {v}
        </a>
      );
    }
    if (/^mailto:|@.+\..+/i.test(v) && !v.includes(" ")) {
      return (
        <a href={v.startsWith("mailto:") ? v : `mailto:${v}`} className="text-primary hover:underline">
          {v}
        </a>
      );
    }
    return <span className="text-foreground">{v}</span>;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return <span className="text-foreground">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground italic">vuoto</span>;
    return (
      <ul className="list-disc list-inside space-y-0.5">
        {v.map((item, i) => (
          <li key={i} className="text-[11px]">{renderValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") {
    return (
      <pre className="text-[10px] font-mono bg-muted/40 rounded p-1.5 mt-1 whitespace-pre-wrap break-all">
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  }
  return <span>{String(v)}</span>;
}

export function FindingsView({ findings, suggestedNextUrl, onInvestigateUrl }: Props) {
  const [showJson, setShowJson] = React.useState(false);

  const summary = typeof findings._summary === "string" ? findings._summary : "";
  const entries = Object.entries(findings).filter(([k, v]) => {
    if (k.startsWith("_")) return false;
    if (v === null || v === undefined || v === "") return false;
    return true;
  });

  return (
    <div className="space-y-3">
      {summary && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Sintesi AI
          </div>
          <div className="text-xs text-foreground leading-relaxed">{summary}</div>
        </div>
      )}

      {suggestedNextUrl && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
              💡 Prossima ricerca consigliata
            </div>
            <code className="text-[10px] font-mono text-foreground break-all">{suggestedNextUrl}</code>
          </div>
          {onInvestigateUrl && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] shrink-0"
              onClick={() => onInvestigateUrl(suggestedNextUrl)}
            >
              Indaga
            </Button>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic text-center py-6">
          Nessun campo strutturato estratto.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {entries.map(([k, v]) => (
            <div
              key={k}
              className="rounded-md border border-border/60 bg-card p-2.5 flex items-start gap-2"
            >
              <div className="text-muted-foreground mt-0.5 shrink-0">{iconFor(k)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  {humanizeKey(k)}
                </div>
                <div className="text-xs break-words">{renderValue(v)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] gap-1"
          onClick={() => setShowJson((v) => !v)}
        >
          {showJson ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
          {showJson ? "Nascondi JSON" : "Vedi JSON grezzo"}
        </Button>
        {showJson && (
          <pre className="mt-2 text-[10px] font-mono whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3 text-foreground/80 max-h-72 overflow-auto">
            {JSON.stringify(findings, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
