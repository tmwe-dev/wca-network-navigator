/**
 * EnrichmentDetailPopover — Popover che mostra il dettaglio di un risultato
 * di arricchimento (LinkedIn URL, logo preview, snippet sito web).
 *
 * Si attiva click sull'icona corrispondente nella riga.
 */
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Phone, Globe, Linkedin, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrichedRow } from "@/hooks/useEnrichmentData";

type Kind = "linkedin" | "logo" | "site" | "fresh";

interface Props {
  readonly row: EnrichedRow;
  readonly kind: Kind;
  readonly children: React.ReactNode;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  } catch { return ""; }
}

export function EnrichmentDetailPopover({ row, kind, children }: Props): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  const title =
    kind === "linkedin" ? "LinkedIn trovato" :
    kind === "logo" ? "Logo trovato" :
    kind === "site" ? "Sito letto" :
    "Arricchita ora";

  const Icon =
    kind === "linkedin" ? Linkedin :
    kind === "logo" ? ImageIcon :
    kind === "site" ? Globe :
    Sparkles;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className={cn(
            "inline-flex items-center justify-center rounded-sm transition-opacity",
            "hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary/40",
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-72 p-3 text-xs space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 pb-1.5 border-b border-border">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold">{title}</span>
        </div>

        {kind === "linkedin" && (
          <div className="space-y-2">
            {row.linkedinUrl ? (
              <>
                <div className="text-[11px] break-all text-muted-foreground">
                  {row.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </div>
                <Button
                  size="sm" variant="outline"
                  className="h-7 w-full text-[11px] gap-1.5"
                  onClick={() => window.open(row.linkedinUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="w-3 h-3" /> Apri profilo
                </Button>
              </>
            ) : (
              <div className="text-[11px] text-muted-foreground italic">URL non disponibile</div>
            )}
          </div>
        )}

        {kind === "logo" && (
          <div className="space-y-2">
            {row.logoUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={row.logoUrl}
                  alt={`Logo ${row.name}`}
                  className="w-12 h-12 rounded border border-border object-contain bg-background"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium truncate">{row.name}</div>
                  {row.domain && (
                    <div className="text-xs text-foreground/70 truncate">{row.domain}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground italic">
                Logo presente ma URL non in cache locale
              </div>
            )}
          </div>
        )}

        {kind === "site" && (
          <div className="space-y-2">
            {row.websiteExcerpt ? (
              <>
                {row.websiteExcerpt.description && (
                  <p className="text-[11px] text-foreground line-clamp-4 leading-snug">
                    {row.websiteExcerpt.description}
                  </p>
                )}
                {row.websiteExcerpt.emails && row.websiteExcerpt.emails.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email ({row.websiteExcerpt.emails.length})
                    </div>
                    {row.websiteExcerpt.emails.slice(0, 3).map((e) => (
                      <div key={e} className="text-[11px] text-primary truncate">{e}</div>
                    ))}
                  </div>
                )}
                {row.websiteExcerpt.phones && row.websiteExcerpt.phones.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Telefoni ({row.websiteExcerpt.phones.length})
                    </div>
                    {row.websiteExcerpt.phones.slice(0, 2).map((p) => (
                      <div key={p} className="text-[11px] text-foreground">{p}</div>
                    ))}
                  </div>
                )}
                {row.websiteExcerpt.scraped_at && (
                  <div className="text-[11px] text-foreground/70/70 pt-1 border-t border-border">
                    Letto il {formatDate(row.websiteExcerpt.scraped_at)}
                  </div>
                )}
                {row.domain && (
                  <Button
                    size="sm" variant="outline"
                    className="h-7 w-full text-[11px] gap-1.5"
                    onClick={() => window.open(`https://${row.domain}`, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="w-3 h-3" /> Apri sito
                  </Button>
                )}
              </>
            ) : (
              <div className="text-[11px] text-muted-foreground italic">
                Sito letto, snippet non disponibile
              </div>
            )}
          </div>
        )}

        {kind === "fresh" && (
          <div className="text-[11px] text-muted-foreground">
            Questa riga è stata arricchita in questa sessione.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}