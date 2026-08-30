/**
 * CommandPalette — Ricerca globale di sistema (⌘K).
 * Cerca in: pagine, funzioni/azioni, partner, contatti e campi/tabelle DB.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Building2, User, Database, Zap, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SEARCH_PAGES, SEARCH_ACTIONS } from "@/v2/search/searchIndex";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { query: debounced, data, loading } = useGlobalSearch(search, open);


  const q = debounced.toLowerCase();

  const pages = useMemo(() => {
    if (!q) return SEARCH_PAGES.slice(0, 8);
    return SEARCH_PAGES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q) || p.path.includes(q),
    ).slice(0, 10);
  }, [q]);

  const actions = useMemo(() => {
    if (!q) return SEARCH_ACTIONS.slice(0, 6);
    return SEARCH_ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q) || a.hint.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [q]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    setSearch("");
    fn();
  };

  const copyField = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast({ title: "Campo copiato", description: text });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Cerca ovunque: pagine, funzioni, partner, contatti, campi…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ricerca in corso…
            </span>
          ) : (
            "Nessun risultato trovato."
          )}
        </CommandEmpty>

        {actions.length > 0 && (
          <CommandGroup heading="Funzioni">
            {actions.map((a) => (
              <CommandItem key={a.label} value={`azione ${a.label} ${a.keywords}`} onSelect={() => run(() => navigate(a.path))}>
                <Zap className="mr-2 h-4 w-4 text-primary" />
                <span className="flex-1">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {pages.length > 0 && (
          <CommandGroup heading="Pagine">
            {pages.map((p) => (
              <CommandItem key={p.path} value={`pagina ${p.label} ${p.group} ${p.path}`} onSelect={() => run(() => navigate(p.path))}>
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.partners.length > 0 && (
          <CommandGroup heading="Partner">
            {data.partners.map((p) => (
              <CommandItem
                key={p.id}
                value={`partner ${p.company_name}`}
                onSelect={() => run(() => navigate(`/v2/explore/network?partner=${p.id}`))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{p.company_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[p.city, p.country_name].filter(Boolean).join(", ")}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.contacts.length > 0 && (
          <CommandGroup heading="Contatti">
            {data.contacts.map((c) => (
              <CommandItem
                key={c.id}
                value={`contatto ${c.name ?? ""} ${c.email ?? ""}`}
                onSelect={() => run(() => navigate("/v2/explore/contacts"))}
              >
                <User className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{c.name ?? c.email ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {[c.email, c.company, c.source].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.fields.length > 0 && (
          <CommandGroup heading="Campi di sistema">
            {data.fields.map((f) => (
              <CommandItem
                key={`${f.table}.${f.column}`}
                value={`campo ${f.table} ${f.column}`}
                onSelect={() => run(() => copyField(`${f.table}.${f.column}`))}
              >
                <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  {f.table}.<span className="font-medium">{f.column}</span>
                </span>
                <span className="text-xs text-muted-foreground">{f.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
