import { useRef } from "react";
import { Download, Loader2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CompanyLogo, CompanyLogoInline, CountryFlag } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import type { DownloadedEmail } from "@/lib/backgroundSync";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  emails: DownloadedEmail[];
  selectedEmailId: string | null;
  onSelect: (emailId: string) => void;
  isRunning: boolean;
  isLoading?: boolean;
  emailCount: number;
};

const ROW_HEIGHT = 64;

export function DownloadedEmailList({ emails, selectedEmailId, onSelect, isRunning, isLoading = false, emailCount }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const visibleLabel = emailCount > emails.length ? `ultime ${emails.length} visibili` : `${emails.length} visibili`;

  return (
    <div className="flex w-[320px] flex-shrink-0 flex-col overflow-hidden border-r border-border bg-background">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="space-y-2 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            <p className="text-sm">Caricamento email…</p>
          </div>
        </div>
      ) : emails.length === 0 && !isRunning ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="space-y-2 text-center">
            <Download className="mx-auto h-10 w-10 opacity-30" />
            <p className="text-sm">Premi "Scarica Tutto" per iniziare</p>
          </div>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const email = emails[virtualRow.index];
              const { brand } = extractSenderBrand(email.from);
              const isSelected = selectedEmailId === email.id;

              return (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => onSelect(email.id)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left transition-all duration-150",
                    "hover:bg-accent/50",
                    isSelected ? "border-l-2 border-primary bg-primary/10" : "border-l-2 border-transparent",
                  )}
                >
                  <CompanyLogo email={email.from} name={brand} size={24} className="mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] font-bold leading-tight text-primary flex items-center gap-1">
                        {brand}
                        <CompanyLogoInline email={email.from} size={14} />
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <CountryFlag email={email.from} size={16} />
                        <span className="text-[10px] text-muted-foreground/70">{formatTime(email.date)}</span>
                      </div>
                    </div>
                    <div className="mt-0.5 truncate text-xs leading-tight text-foreground">{email.subject}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-primary animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scaricamento in corso...
            </div>
          )}
        </div>
      )}

      <div className="flex flex-shrink-0 items-center justify-between border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <span>{visibleLabel}</span>
        <span className="font-mono">{emailCount.toLocaleString()} totali</span>
      </div>
    </div>
  );
}
