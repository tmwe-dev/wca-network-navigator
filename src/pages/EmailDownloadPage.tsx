/**
 * Dedicated email download page — Matrix-style live feed with email preview slides.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Download, Square, RotateCcw, Loader2, CheckCircle2, AlertCircle, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailHtmlFrame } from "@/components/outreach/email/EmailHtmlFrame";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailCount } from "@/hooks/useEmailCount";
import {
  bgSyncSubscribe, bgSyncSubscribeEmails, bgSyncStart, bgSyncStop,
  bgSyncIsRunning, bgSyncGetEmailHistory,
  type BgSyncProgress, type DownloadedEmail,
} from "@/lib/backgroundSync";

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/** Extract brand/company name from email address or display name */
function extractSenderBrand(from: string): { brand: string; detail: string } {
  if (!from) return { brand: "Sconosciuto", detail: "" };

  // Try to get display name first: "John Doe <john@fedex.com>"
  const displayMatch = from.match(/^"?([^"<]+)"?\s*<(.+)>/);
  const displayName = displayMatch ? displayMatch[1].trim() : "";
  const emailAddr = displayMatch ? displayMatch[2].trim() : from.trim();

  // Extract domain from email
  const domainMatch = emailAddr.match(/@([^>]+)/);
  const domain = domainMatch ? domainMatch[1].toLowerCase() : "";

  // Known personal email providers
  const personalProviders = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
    "fastmail.com", "zoho.com", "mail.com", "yandex.com", "gmx.com",
    "libero.it", "virgilio.it", "alice.it", "tin.it", "tiscali.it",
    "yahoo.it", "hotmail.it", "outlook.it", "pec.it",
  ]);

  const isPersonal = personalProviders.has(domain);

  if (isPersonal) {
    // Personal email — show display name or local part
    const localPart = emailAddr.split("@")[0] || "";
    const name = displayName || localPart.replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return { brand: name, detail: emailAddr };
  }

  // Business email — extract company name from domain
  const domainParts = domain.split(".");
  // Remove TLD(s) — handle .co.uk, .com.br etc.
  let companySlug = domainParts[0];
  if (domainParts.length > 2 && ["co", "com", "org", "net"].includes(domainParts[domainParts.length - 2])) {
    companySlug = domainParts.slice(0, -2).join(".");
  } else if (domainParts.length > 1) {
    companySlug = domainParts.slice(0, -1).join(".");
  }

  // Capitalize brand name
  const brand = companySlug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  const detail = displayName ? `${displayName} — ${emailAddr}` : emailAddr;

  return { brand, detail };
}

export default function EmailDownloadPage() {
  const [progress, setProgress] = useState<BgSyncProgress>(() => ({
    downloaded: 0, batch: 0, lastSubject: "", status: "idle", elapsedSeconds: 0,
  }));
  const [emails, setEmails] = useState<DownloadedEmail[]>(() => bgSyncGetEmailHistory());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(bgSyncIsRunning);
  const listEndRef = useRef<HTMLDivElement>(null);
  const resetSync = useResetSync();
  const { data: emailCount = 0 } = useEmailCount(isSyncing);

  useEffect(() => {
    const unsub1 = bgSyncSubscribe((p) => {
      setProgress(p);
      setIsSyncing(p.status === "syncing");
    });
    const unsub2 = bgSyncSubscribeEmails((e) => {
      setEmails(prev => [...prev, e]);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Auto-scroll list & auto-select latest
  useEffect(() => {
    if (emails.length > 0) {
      setSelectedIdx(emails.length - 1);
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [emails.length]);

  const handleStart = useCallback(() => {
    setEmails([]);
    setSelectedIdx(null);
    bgSyncStart();
  }, []);

  const selectedEmail = selectedIdx !== null ? emails[selectedIdx] : null;
  const isRunning = progress.status === "syncing";
  const isDone = progress.status === "done";
  const isError = progress.status === "error";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Download Email
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {emailCount.toLocaleString()} email in database
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <Clock className="w-3.5 h-3.5" />
                {formatElapsed(progress.elapsedSeconds)}
                <span className="text-primary font-bold ml-2">{progress.downloaded}</span>
                <span>scaricate</span>
              </div>
            )}
            {isDone && (
              <div className="flex items-center gap-1.5 text-xs text-primary mr-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completato — {progress.downloaded} email in {formatElapsed(progress.elapsedSeconds)}
              </div>
            )}
            {isError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive mr-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {progress.errorMessage}
              </div>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => resetSync.mutate()}
              disabled={resetSync.isPending || isSyncing}
              className="gap-1.5"
            >
              {resetSync.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Reset
            </Button>

            {isSyncing ? (
              <Button size="sm" variant="destructive" onClick={bgSyncStop} className="gap-1.5">
                <Square className="w-3.5 h-3.5" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={handleStart} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Scarica Tutto
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main canvas: left list + right preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Matrix-style email list */}
        <div className="w-[300px] flex-shrink-0 border-r border-border bg-[hsl(var(--background))] flex flex-col">
          {emails.length === 0 && !isRunning ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Download className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Premi "Scarica Tutto" per iniziare</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-1">
                {emails.map((email, idx) => {
                  const { brand } = extractSenderBrand(email.from);
                  return (
                    <div
                      key={email.id}
                      onClick={() => setSelectedIdx(idx)}
                      className={cn(
                        "flex items-start gap-2 px-3 py-2 rounded cursor-pointer transition-all duration-150 group",
                        "hover:bg-accent/50",
                        selectedIdx === idx
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "border-l-2 border-transparent",
                        "animate-fade-in"
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground/50 font-mono mt-1 w-5 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-primary truncate leading-tight">
                          {brand}
                        </div>
                        <div className="text-xs text-foreground truncate leading-tight mt-0.5">
                          {email.subject}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatTime(email.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={listEndRef} />
                {isRunning && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-primary animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Scaricamento in corso...
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Bottom counter */}
          <div className="flex-shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/30">
            <span>{emails.length} scaricate in questa sessione</span>
            <span className="font-mono">{emailCount.toLocaleString()} totali</span>
          </div>
        </div>

        {/* Right: Email preview — pinned header + scrollable body */}
        <div className="flex-1 min-w-0 bg-muted/20 flex flex-col overflow-hidden">
          {selectedEmail ? (
            <EmailSlide email={selectedEmail} key={selectedEmail.id} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center">
              <div>
                <Mail className="w-12 h-12 mx-auto opacity-20 mb-2" />
                <p>Seleziona una email per visualizzarla</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Email preview rendered as a slide/card — pinned header + scrollable body */
function EmailSlide({ email }: { email: DownloadedEmail }) {
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { brand, detail } = extractSenderBrand(email.from);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFullHtml(null);

    supabase
      .from("channel_messages")
      .select("body_html, body_text")
      .eq("id", email.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.body_html) {
          setFullHtml(data.body_html);
        } else if (data?.body_text) {
          setFullHtml(`<pre style="font-family:sans-serif;white-space:pre-wrap;padding:20px;color:#333;">${data.body_text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
        } else {
          setFullHtml(email.bodyHtml || `<pre style="font-family:sans-serif;white-space:pre-wrap;padding:20px;color:#333;">${(email.bodyText || "(nessun contenuto)").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [email.id]);

  const htmlContent = fullHtml || email.bodyHtml || `<p style="padding:20px;color:#999;">Caricamento...</p>`;

  return (
    <div className="flex flex-col h-full">
      {/* Pinned header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-5 py-3">
        <div className="text-base font-bold text-primary">{brand}</div>
        <div className="text-sm font-semibold text-foreground truncate mt-0.5">{email.subject}</div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {detail || email.from} — {formatTime(email.date)}
        </div>
      </div>
      {/* Scrollable email body */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <EmailHtmlFrame html={htmlContent} mode="faithful" blockRemote={false} />
        )}
      </div>
    </div>
  );
}
