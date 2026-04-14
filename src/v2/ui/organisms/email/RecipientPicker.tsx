/**
 * RecipientPicker — Autocomplete contact search + chip display
 */
import * as React from "react";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, Plus } from "lucide-react";
import type { EmailRecipient } from "@/v2/hooks/useEmailComposerV2";
import { queryKeys } from "@/lib/queryKeys";

interface RecipientPickerProps {
  readonly recipients: readonly EmailRecipient[];
  readonly onAdd: (r: EmailRecipient) => void;
  readonly onRemove: (email: string) => void;
}

export function RecipientPicker({ recipients, onAdd, onRemove }: RecipientPickerProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [showManual, setShowManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results } = useQuery({
    queryKey: queryKeys.v2.recipientSearch(search),
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email")
        .not("email", "is", null)
        .or(`name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`)
        .limit(10);
      return data ?? [];
    },
  });

  const handleSelect = (r: { id: string; name: string | null; company_name: string | null; email: string | null }) => {
    if (!r.email) return;
    onAdd({
      email: r.email,
      name: r.name ?? r.company_name ?? r.email,
      companyName: r.company_name ?? undefined,
      contactId: r.id,
    });
    setSearch("");
    setShowDropdown(false);
  };

  const handleManualAdd = () => {
    if (!manualEmail || !manualEmail.includes("@")) return;
    onAdd({ email: manualEmail, name: manualEmail });
    setManualEmail("");
    setShowManual(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destinatari</label>

      {/* Chips */}
      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipients.map((r) => (
            <span key={r.email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
              <span className="truncate max-w-[120px]">{r.name}</span>
              <button onClick={() => onRemove(r.email)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Cerca contatto..."
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background text-foreground"
        />

        {showDropdown && results && results.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                className="w-full text-left px-3 py-1.5 hover:bg-accent/50 text-xs"
                onMouseDown={() => handleSelect(r)}
              >
                <span className="font-medium text-foreground">{r.name ?? r.company_name}</span>
                <span className="text-muted-foreground ml-1.5">{r.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual add */}
      {showManual ? (
        <div className="flex gap-1">
          <input
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
            placeholder="email@example.com"
            className="flex-1 px-2 py-1 text-xs rounded border bg-background text-foreground"
          />
          <button onClick={handleManualAdd} className="text-xs text-primary hover:underline px-1">Aggiungi</button>
        </div>
      ) : (
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Inserisci manualmente
        </button>
      )}
    </div>
  );
}
