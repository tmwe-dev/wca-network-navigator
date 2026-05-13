/**
 * EmailLanguagePicker — selettore di lingua per email (singola e bulk).
 *
 * Tre opzioni rapide + dropdown lingue specifiche:
 *   🇮🇹 Italiano · 🇬🇧 Inglese · 🌍 Auto · ⚙️ Specifica…
 *
 * Mostra un badge informativo che spiega la decisione corrente quando in
 * modalità "Auto" (es. "Rilevata: francese (FR)" oppure "Fallback: inglese
 * paese sconosciuto"). La risoluzione effettiva viene fatta a `generate`,
 * questo componente è puramente di selezione.
 */
import * as React from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LANGUAGES,
  type LanguageMode,
  type ResolvedLanguage,
  resolveLanguage,
} from "@/lib/languages";

interface Props {
  value: LanguageMode;
  onChange: (mode: LanguageMode) => void;
  /** Contesto del destinatario corrente (per il badge "Auto"). */
  recipientContext?: { countryCode?: string | null; countryName?: string | null };
  /** Disabilita la selezione (es. durante una generazione AI). */
  disabled?: boolean;
  /** Variante compatta per toolbar strette. */
  compact?: boolean;
  className?: string;
}

const QUICK_OPTIONS: Array<{ kind: LanguageMode["kind"]; flag: string; label: string }> = [
  { kind: "italiano", flag: "🇮🇹", label: "Italiano" },
  { kind: "inglese",  flag: "🇬🇧", label: "Inglese" },
  { kind: "auto",     flag: "🌍",  label: "Auto" },
];

export function EmailLanguagePicker({
  value,
  onChange,
  recipientContext,
  disabled,
  compact,
  className,
}: Props): React.ReactElement {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const resolved: ResolvedLanguage = React.useMemo(
    () => resolveLanguage(value, recipientContext ?? {}),
    [value, recipientContext],
  );

  const isSpecific = value.kind === "specific";
  const specificLabel = isSpecific
    ? LANGUAGES.find((l) => l.key === value.key)?.labelIt ?? value.key
    : "Specifica…";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
      {!compact && (
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
          Lingua
        </span>
      )}
      <div className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 p-0.5">
        {QUICK_OPTIONS.map((opt) => {
          const active = value.kind === opt.kind;
          return (
            <button
              key={opt.kind}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ kind: opt.kind } as LanguageMode)}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded-sm transition-colors flex items-center gap-1",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-background",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              aria-pressed={active}
              title={opt.label}
            >
              <span aria-hidden>{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded-sm transition-colors flex items-center gap-1",
                isSpecific
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-background",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              aria-pressed={isSpecific}
              title="Scegli una lingua specifica"
            >
              <span>{specificLabel}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-64" align="start">
            <Command>
              <CommandInput placeholder="Cerca lingua…" className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty className="py-3 text-xs text-muted-foreground">
                  Nessuna lingua trovata.
                </CommandEmpty>
                <CommandGroup>
                  {LANGUAGES.map((lang) => {
                    const selected = isSpecific && value.key === lang.key;
                    return (
                      <CommandItem
                        key={lang.key}
                        value={`${lang.labelIt} ${lang.native} ${lang.iso}`}
                        onSelect={() => {
                          onChange({ kind: "specific", key: lang.key });
                          setPickerOpen(false);
                        }}
                        className="text-xs gap-2"
                      >
                        <span aria-hidden className="text-base leading-none">{lang.flag}</span>
                        <span className="flex-1">
                          {lang.labelIt}
                          <span className="ml-1 text-muted-foreground">· {lang.native}</span>
                        </span>
                        {selected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {value.kind === "auto" && (
        <Badge
          variant="outline"
          className={cn(
            "h-5 text-[10px] font-normal gap-1",
            resolved.source === "fallback_english"
              ? "border-amber-500/50 text-amber-700 dark:text-amber-300"
              : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
          )}
          title={
            resolved.source === "fallback_english"
              ? "Origine non confermata: per sicurezza si scrive in inglese."
              : "Lingua dedotta dal paese del contatto."
          }
        >
          {resolved.label}
        </Badge>
      )}
    </div>
  );
}