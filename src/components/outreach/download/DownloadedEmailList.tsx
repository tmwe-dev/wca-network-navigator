import { Download, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import type { DownloadedEmail } from "@/lib/backgroundSync";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type Props = {
  emails: DownloadedEmail[];
  selectedEmailId: string | null;
  onSelect: (emailId: string) => void;
  isRunning: boolean;
  isLoading?: boolean;
  emailCount: number;
};

export function DownloadedEmailList({
  emails,
  selectedEmailId,
  onSelect,
  isRunning,
  isLoading = false,
  emailCount,
}: Props) {
  const visibleLabel = emailCount > emails.length
    ? `ultime ${emails.length} visibili`
    : `${emails.length} visibili`;

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
            <p className="text-sm">Premi “Scarica Tutto” per iniziare</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-1">
            {emails.map((email) => {
              const { brand } = extractSenderBrand(email.from);
              const isSelected = selectedEmailId === email.id;

              return (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => onSelect(email.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded px-3 py-2 text-left transition-all duration-150",
                    "hover:bg-accent/50",
                    isSelected
                      ? "border-l-2 border-primary bg-primary/10"
                      : "border-l-2 border-transparent",
                  )}
                >
                  <CompanyLogo email={email.from} name={brand} size={24} className="mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold leading-tight text-primary">{brand}</div>
                    <div className="mt-0.5 truncate text-xs leading-tight text-foreground">{email.subject}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/70">{formatTime(email.date)}</div>
                  </div>
                </button>
              );
            })}
            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-primary animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scaricamento in corso...
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="flex flex-shrink-0 items-center justify-between border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <span>{visibleLabel}</span>
        <span className="font-mono">{emailCount.toLocaleString()} totali</span>
      </div>
    </div>
  );
}
