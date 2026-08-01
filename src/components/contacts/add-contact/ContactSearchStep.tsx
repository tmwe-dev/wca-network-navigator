/**
 * ContactSearchStep — Google search + results + name fields
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Loader2, ExternalLink } from "lucide-react";
import type { ContactFormData, GoogleSearchResult } from "@/hooks/useAddContactForm";

interface ContactSearchStepProps {
  readonly companyName: string;
  readonly contactName: string;
  readonly placesLoading: boolean;
  readonly placesResults: GoogleSearchResult[];
  readonly onFieldChange: (field: keyof ContactFormData, value: string) => void;
  readonly onSearch: () => void;
  readonly onApplyResult: (result: GoogleSearchResult) => void;
}

export function ContactSearchStep({
  companyName, contactName, placesLoading, placesResults,
  onFieldChange, onSearch, onApplyResult,
}: ContactSearchStepProps): React.ReactElement {
  return (
    <div className="space-y-3 mt-3">
      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome Azienda *</Label>
          <Input value={companyName} onChange={e => onFieldChange("companyName", e.target.value)} placeholder="Es. Acme Logistics Srl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nome Contatto</Label>
          <Input value={contactName} onChange={e => onFieldChange("contactName", e.target.value)} placeholder="Mario Rossi" />
        </div>
      </div>

      {/* Google Search */}
      <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium">
            <MapPin className="w-4 h-4 text-destructive" /> Cerca su Google
          </div>
          <Button size="sm" onClick={onSearch} disabled={placesLoading || !companyName.trim()}>
            {placesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1">Cerca</span>
          </Button>
        </div>
        {placesResults.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {placesResults.map((r, i) => (
              <button key={i}
                className="w-full text-left text-xs p-2 rounded hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                onClick={() => onApplyResult(r)}>
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <span className="font-medium">{r.title}</span>
                    {r.url && <p className="text-[10px] text-muted-foreground truncate">{r.url}</p>}
                    {r.description && <p className="text-muted-foreground line-clamp-2">{r.description}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
