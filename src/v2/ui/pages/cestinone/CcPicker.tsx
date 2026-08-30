/**
 * CcPicker — selezione destinatari CC/CCN prima dell'invio.
 * Cerca in tutta la rubrica (contatti, partner, biglietti) oppure
 * accetta un indirizzo digitato manualmente.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Plus } from "lucide-react";
import { searchAddressBook, addressBookKeys } from "@/data/addressBook";
import { Badge } from "@/components/ui/badge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CcPickerProps {
  readonly label: string;
  readonly values: readonly string[];
  readonly onChange: (next: string[]) => void;
}

export function CcPicker({ label, values, onChange }: CcPickerProps): React.ReactElement {
  const [term, setTerm] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data: results } = useQuery({
    queryKey: addressBookKeys.search(term),
    enabled: term.trim().length >= 2,
    queryFn: () => searchAddressBook(term),
    staleTime: 30_000,
  });

  const add = (email: string): void => {
    const e = email.trim();
    if (!EMAIL_RE.test(e)) return;
    if (values.some((v) => v.toLowerCase() === e.toLowerCase())) return;
    onChange([...values, e]);
    setTerm("");
    setOpen(false);
  };

  const manualValid = EMAIL_RE.test(term.trim());

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-9">{label}</span>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualValid) {
                e.preventDefault();
                add(term);
              }
            }}
            placeholder="Cerca in rubrica o scrivi un indirizzo…"
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md border bg-background text-foreground"
          />

          {open && (results?.length || manualValid) ? (
            <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
              {manualValid && (
                <button
                  type="button"
                  className="w-full text-left px-2.5 py-1.5 hover:bg-accent/50 text-xs flex items-center gap-1.5"
                  onMouseDown={() => add(term)}
                >
                  <Plus className="h-3 w-3" /> Aggiungi <span className="font-medium">{term.trim()}</span>
                </button>
              )}
              {(results ?? []).map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-accent/50 text-xs"
                  onMouseDown={() => add(r.email)}
                >
                  <span className="font-medium text-foreground">{r.name ?? r.company ?? r.email}</span>
                  <span className="text-muted-foreground ml-1.5">{r.email}</span>
                  <Badge variant="outline" className="ml-1.5 text-[9px]">
                    {r.source}
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-11">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]"
            >
              <span className="truncate max-w-[160px]">{v}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="hover:text-destructive"
                aria-label={`Rimuovi ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
