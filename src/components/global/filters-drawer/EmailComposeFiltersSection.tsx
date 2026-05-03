/**
 * EmailComposeFiltersSection — sezione filtri della sidebar globale dedicata
 * al Compose Email. Raccoglie i controlli che storicamente vivevano dentro
 * `OraclePanel` (tipo email, tono, brief strutturato, KB on/off) e li espone
 * tramite `ComposeAiConfigContext`. Nessuna chiamata AI qui.
 */
import * as React from "react";
import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import BriefAccordion from "@/components/email/BriefAccordion";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useComposeAiConfig } from "@/contexts/ComposeAiConfigContext";
import { BookOpen, Briefcase, ClipboardList, GraduationCap, Globe, Handshake, Plane, RefreshCw, Smile, Target, type LucideIcon } from "lucide-react";
import { createLogger } from "@/lib/log";
import { cn } from "@/lib/utils";

const log = createLogger("EmailComposeFiltersSection");

const EMAIL_TYPE_ICONS: Record<string, LucideIcon> = {
  Handshake,
  RefreshCw,
  ClipboardList,
  Briefcase,
  Globe,
  Plane,
};

const TONE_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  Briefcase,
  Smile,
  Target,
};

const STYLE_BY_INDEX = [
  "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
  "border-accent/30 bg-accent/10 text-accent-foreground hover:bg-accent/15",
  "border-success/30 bg-success/10 text-success hover:bg-success/15",
  "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15",
  "border-info/30 bg-info/10 text-info hover:bg-info/15",
  "border-secondary/40 bg-secondary/20 text-secondary-foreground hover:bg-secondary/30",
];

export function EmailComposeFiltersSection(): React.ReactElement {
  const { selectedType, setSelectedType, tone, setTone, useKB, setUseKB, brief, setBrief } =
    useComposeAiConfig();

  const { data: settings } = useAppSettings();

  const customTypes: EmailType[] = useMemo(() => {
    try {
      return JSON.parse(settings?.email_oracle_types || "[]") as EmailType[];
    } catch (e) {
      log.debug("custom types parse failed", { error: e instanceof Error ? e.message : String(e) });
      return [];
    }
  }, [settings?.email_oracle_types]);

  const allTypes = useMemo(() => {
    const byId = new Map<string, EmailType>();
    [...DEFAULT_EMAIL_TYPES, ...customTypes].forEach((type) => byId.set(type.id, type));
    return Array.from(byId.values());
  }, [customTypes]);

  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Tipo di email
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedType(null)}
            className={cn(
              "h-14 rounded-lg border px-2 text-[10px] font-semibold transition-all flex flex-col items-center justify-center gap-1",
              !selectedType
                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "border-border/50 bg-background/55 text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
            aria-pressed={!selectedType}
          >
            <SparkleIcon />
            Libero
          </button>
          {allTypes.map((t, index) => {
            const Icon = EMAIL_TYPE_ICONS[t.icon] ?? MailIcon;
            const selected = selectedType?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t)}
                className={cn(
                  "h-14 rounded-lg border px-2 text-[10px] font-semibold transition-all flex flex-col items-center justify-center gap-1",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : STYLE_BY_INDEX[index % STYLE_BY_INDEX.length],
                )}
                aria-pressed={selected}
                title={t.name}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="line-clamp-2 leading-tight">{t.name}</span>
              </button>
            );
          })}
        </div>
        {selectedType?.structure && (
          <p className="rounded-md border border-primary/15 bg-primary/5 px-2 py-1.5 text-[10px] text-primary">
            Struttura: {selectedType.structure}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Tono
        </label>
        <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-border/40 bg-background/45 p-1.5">
          {TONE_OPTIONS.map((t) => {
            const Icon = TONE_ICONS[t.icon] ?? Target;
            const selected = tone === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={cn(
                  "h-11 rounded-md text-[9px] font-semibold transition-all flex flex-col items-center justify-center gap-1",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                aria-pressed={selected}
                title={t.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate max-w-full">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <BriefAccordion brief={brief} onChange={setBrief} />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <div>
            <div className="text-xs font-medium">Knowledge Base</div>
            <div className="text-[10px] text-muted-foreground">
              Inietta documenti aziendali nel prompt
            </div>
          </div>
        </div>
        <Switch checked={useKB} onCheckedChange={setUseKB} />
      </div>
    </section>
  );
}

function SparkleIcon(): React.ReactElement {
  return <span className="text-base leading-none">✦</span>;
}

function MailIcon({ className }: { className?: string }): React.ReactElement {
  return <BookOpen className={className} />;
}
