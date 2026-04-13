import { useState, useMemo } from "react";
import { Search, Mail, Phone, Linkedin, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface UnifiedContact {
  id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  country?: string;
  origin: string;
  linkedinUrl?: string;
  partnerId?: string | null;
}

interface Props {
  contacts: UnifiedContact[];
  selected?: string | null;
  onSelect: (c: UnifiedContact) => void;
  compact?: boolean;
  className?: string;
}

export function UnifiedContactList({ contacts, selected, onSelect, compact, className }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca contatto..."
            className="pl-8 h-8 text-xs bg-muted/30"
          />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {filtered.length} di {contacts.length} contatti
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/30">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={cn(
                "w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/40",
                selected === c.id && "bg-primary/5 border-l-2 border-primary"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{c.origin}</span>
              </div>
              {!compact && (
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">{c.company}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {c.email && <Mail className="h-3 w-3 text-muted-foreground/60" />}
                {c.phone && <Phone className="h-3 w-3 text-muted-foreground/60" />}
                {c.linkedinUrl && <Linkedin className="h-3 w-3 text-muted-foreground/60" />}
                {c.country && (
                  <span className="text-[10px] text-muted-foreground ml-auto">{c.country}</span>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Nessun contatto trovato</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
