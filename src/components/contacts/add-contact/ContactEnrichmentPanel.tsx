/**
 * ContactEnrichmentPanel — Logo, LinkedIn, Deep Search, extension warning, website display
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image, Linkedin, Radar, Globe, Loader2 } from "lucide-react";
import { extractDomain } from "@/hooks/useAddContactForm";

interface ContactEnrichmentPanelProps {
  readonly logoUrl: string;
  readonly linkedinUrl: string;
  readonly website: string;
  readonly savedId: string | null;
  readonly logoLoading: boolean;
  readonly linkedinLoading: boolean;
  readonly deepSearchRunning: boolean;
  readonly fsBridgeAvailable: boolean;
  readonly onLogoSearch: () => void;
  readonly onLinkedInSearch: () => void;
  readonly onDeepSearch: () => void;
  readonly onLogoError: () => void;
}

export function ContactEnrichmentPanel({
  logoUrl, linkedinUrl, website, savedId,
  logoLoading, linkedinLoading, deepSearchRunning, fsBridgeAvailable,
  onLogoSearch, onLinkedInSearch, onDeepSearch, onLogoError,
}: ContactEnrichmentPanelProps): React.ReactElement {
  return (
    <>
      {/* Logo + LinkedIn side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Logo */}
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Image className="w-4 h-4 text-emerald-500" /> Logo
            </div>
            <Button size="sm" variant="outline" onClick={onLogoSearch} disabled={logoLoading} className="h-7 text-xs">
              {logoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cerca"}
            </Button>
          </div>
          {logoUrl && (
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded border" onError={onLogoError} />
              <span className="text-[10px] text-muted-foreground truncate">{extractDomain(website || logoUrl)}</span>
            </div>
          )}
        </div>

        {/* LinkedIn */}
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Linkedin className="w-4 h-4 text-muted-foreground" /> LinkedIn
            </div>
            <Button size="sm" variant="outline" onClick={onLinkedInSearch} disabled={linkedinLoading} className="h-7 text-xs">
              {linkedinLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cerca"}
            </Button>
          </div>
          {linkedinUrl && (
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate block">
              {linkedinUrl.replace("https://www.", "").replace("https://", "")}
            </a>
          )}
        </div>
      </div>

      {/* Deep Search */}
      <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Radar className="w-4 h-4 text-primary" /> Deep Search
          </div>
          <Button size="sm" variant="outline" onClick={onDeepSearch}
            disabled={!savedId || deepSearchRunning} className="h-7 text-xs">
            {deepSearchRunning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            {savedId ? "Avvia" : "Salva prima"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {savedId
            ? "Avvia il Deep Search completo del sistema sul contatto salvato"
            : "Salva il contatto, poi potrai avviare la Deep Search completa"}
        </p>
      </div>

      {!fsBridgeAvailable && (
        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
          ⚠ Estensione Partner Connect non rilevata — ricerche limitate
        </Badge>
      )}

      {website && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="w-3 h-3" />
          <span className="truncate">{website}</span>
        </div>
      )}
    </>
  );
}
