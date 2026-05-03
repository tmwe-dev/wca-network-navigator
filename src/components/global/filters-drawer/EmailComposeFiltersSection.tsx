/**
 * EmailComposeFiltersSection — sezione filtri della sidebar globale dedicata
 * al Compose Email. Raccoglie i controlli che storicamente vivevano dentro
 * `OraclePanel` (tipo email, tono, brief strutturato, KB on/off) e li espone
 * tramite `ComposeAiConfigContext`. Nessuna chiamata AI qui.
 */
import * as React from "react";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import BriefAccordion from "@/components/email/BriefAccordion";
import { DEFAULT_EMAIL_TYPES, TONE_OPTIONS, type EmailType } from "@/data/defaultEmailTypes";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useComposeAiConfig } from "@/contexts/ComposeAiConfigContext";
import { BookOpen } from "lucide-react";
import { createLogger } from "@/lib/log";

const log = createLogger("EmailComposeFiltersSection");

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

  const allTypes = useMemo(() => [...DEFAULT_EMAIL_TYPES, ...customTypes], [customTypes]);

  const handleTypeChange = (id: string) => {
    if (id === "__none__") {
      setSelectedType(null);
      return;
    }
    const t = allTypes.find((x) => x.id === id) || null;
    setSelectedType(t);
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tipo di email
        </label>
        <Select value={selectedType?.id ?? "__none__"} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Scegli un tipo…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs italic">
              Nessuno (libero)
            </SelectItem>
            {allTypes.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                <span className="mr-1.5">{t.icon}</span>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedType?.structure && (
          <p className="text-[10px] text-muted-foreground italic">
            Struttura: {selectedType.structure}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tono
        </label>
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Brief strutturato
        </label>
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
