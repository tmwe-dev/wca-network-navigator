/**
 * FloatingCoPilot — bolla flottante draggable persistente su tutte le route V2.
 *
 * Si NASCONDE su /auth, /v2/login, /v2/command (per non sovrapporsi al
 * Command Hub) e quando il Co-Pilot è disabilitato dall'utente.
 *
 * Architettura: due stati visivi (bolla compatta / pannello espanso). La
 * voce è gestita da `useFloatingCoPilotVoice` (hook dedicato, NON Command).
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Mic, MicOff, X, Activity, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFloatingCoPilotVoice } from "./useFloatingCoPilotVoice";
import { HighlightOverlay, type HighlightTarget } from "./HighlightOverlay";
import { useCoPilot } from "./CoPilotContext";

const HIDDEN_ROUTES = [/^\/auth/, /^\/v2\/login/, /^\/v2\/reset-password/, /^\/v2\/onboarding/, /^\/v2\/command(\/|$)/];
const STORAGE_POS = "copilot.position";

/** Bubble visual size (must match CSS w-/h- of the collapsed bubble) */
const BUBBLE = 56;
/** Safe margin from each viewport edge */
const MARGIN = 16;
/** Avoid the bottom-right corner where MobileBottomNav lives on small screens */
const BOTTOM_RESERVED = 72;

interface Position { x: number; y: number; }

/** Default: anchored bottom-right, above mobile bottom nav. */
function defaultPosition(): Position {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const h = typeof window !== "undefined" ? window.innerHeight : 768;
  return { x: w - BUBBLE - MARGIN, y: h - BUBBLE - BOTTOM_RESERVED };
}

/**
 * Clamp a saved position into the viewport AND push it away from the central
 * danger zone (25%–75% horizontally, 25%–75% vertically) where it would cover
 * tables and detail panels.
 */
function sanitizePosition(p: Position): Position {
  if (typeof window === "undefined") return p;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = p.x + BUBBLE / 2;
  const cy = p.y + BUBBLE / 2;
  const inCenterX = cx > w * 0.25 && cx < w * 0.75;
  const inCenterY = cy > h * 0.25 && cy < h * 0.75;
  if (inCenterX && inCenterY) return defaultPosition();
  // Clamp to viewport with margins
  const x = Math.max(MARGIN, Math.min(w - BUBBLE - MARGIN, p.x));
  const y = Math.max(MARGIN, Math.min(h - BUBBLE - MARGIN, p.y));
  return { x, y };
}

function loadPosition(): Position {
  try {
    const raw = localStorage.getItem(STORAGE_POS);
    if (raw) {
      const parsed = JSON.parse(raw) as Position;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return sanitizePosition(parsed);
      }
    }
  } catch { /* noop */ }
  return defaultPosition();
}

type Corner = "tl" | "tr" | "bl" | "br";
function snapToCorner(corner: Corner): Position {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (corner) {
    case "tl": return { x: MARGIN, y: MARGIN + 56 /* below header */ };
    case "tr": return { x: w - BUBBLE - MARGIN, y: MARGIN + 56 };
    case "bl": return { x: MARGIN, y: h - BUBBLE - BOTTOM_RESERVED };
    case "br": return { x: w - BUBBLE - MARGIN, y: h - BUBBLE - BOTTOM_RESERVED };
  }
}

export function FloatingCoPilot() {
  const location = useLocation();
  const { isEnabled, setEnabled } = useCoPilot();
  const [pos, setPos] = useState<Position>(() => loadPosition());
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState<HighlightTarget | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<{ id: string; label: string } | null>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const voice = useFloatingCoPilotVoice({
    onAction: (label) => setActionLog((l) => [label, ...l].slice(0, 20)),
  });

  // Persistenza posizione
  useEffect(() => {
    try { localStorage.setItem(STORAGE_POS, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  // Re-clamp on viewport resize so the bubble never ends up off-screen.
  useEffect(() => {
    const onResize = () => setPos((p) => sanitizePosition(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Listener: ai-ui-action per highlight + open_modal
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, unknown> | undefined;
      if (!detail) return;
      if (detail.action_type === "highlight") {
        setHighlight({
          selector: detail.selector as string | undefined,
          text: detail.text as string | undefined,
          hint: detail.hint as string | undefined,
          durationMs: detail.durationMs as number | undefined,
        });
      }
    };
    window.addEventListener("ai-ui-action", handler);
    return () => window.removeEventListener("ai-ui-action", handler);
  }, []);

  // Listener: richiesta di conferma dal voice hook
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; label: string } | undefined;
      if (!detail) return;
      setConfirmRequest(detail);
    };
    window.addEventListener("copilot-confirm", handler);
    return () => window.removeEventListener("copilot-confirm", handler);
  }, []);

  const respondConfirmation = (result: "ok" | "cancel") => {
    if (!confirmRequest) return;
    window.dispatchEvent(new CustomEvent("copilot-confirm-result", {
      detail: { id: confirmRequest.id, result },
    }));
    setConfirmRequest(null);
  };

  // Drag
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(8, Math.min(window.innerWidth - 80, e.clientX - dragRef.current.dx));
    const y = Math.max(8, Math.min(window.innerHeight - 80, e.clientY - dragRef.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const isHiddenRoute = HIDDEN_ROUTES.some((r) => r.test(location.pathname));
  if (!isEnabled || isHiddenRoute) {
    return highlight ? <HighlightOverlay target={highlight} onDone={() => setHighlight(null)} /> : null;
  }

  const isActive = voice.status === "connected";
  const isConnecting = voice.status === "connecting";

  return (
    <>
      {highlight && <HighlightOverlay target={highlight} onDone={() => setHighlight(null)} />}

      {confirmRequest && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Conferma azione</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Il Co-Pilot vuole eseguire: <span className="font-medium text-foreground">{confirmRequest.label}</span>. Procedo?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => respondConfirmation("cancel")}>Annulla</Button>
              <Button size="sm" onClick={() => respondConfirmation("ok")}>Conferma</Button>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed z-[9997] select-none"
        style={{ left: pos.x, top: pos.y }}
      >
        {expanded ? (
          <div className="w-[340px] rounded-xl border border-border bg-card shadow-2xl">
            <div
              className="flex items-center justify-between cursor-move rounded-t-xl border-b border-border bg-muted/40 px-3 py-2"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : isConnecting ? "bg-amber-500 animate-pulse" : "bg-muted-foreground"}`} />
                <span className="text-sm font-semibold text-foreground">Co-Pilot</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPos(snapToCorner("tl"))} title="Sposta in alto a sinistra">
                  <span className="text-[10px]">↖</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPos(snapToCorner("tr"))} title="Sposta in alto a destra">
                  <span className="text-[10px]">↗</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPos(snapToCorner("bl"))} title="Sposta in basso a sinistra">
                  <span className="text-[10px]">↙</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPos(snapToCorner("br"))} title="Sposta in basso a destra">
                  <span className="text-[10px]">↘</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEnabled(false)} title="Disattiva Co-Pilot">
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${voice.isSpeaking ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  <div className="text-xs">
                    <div className="font-medium text-foreground">
                      {isActive ? (voice.isSpeaking ? "Sta parlando…" : "In ascolto") : isConnecting ? "Connessione…" : "Spento"}
                    </div>
                    {voice.error && <div className="text-destructive">{voice.error}</div>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isActive ? "destructive" : "default"}
                  onClick={isActive ? voice.stop : voice.start}
                  disabled={isConnecting}
                >
                  {isActive ? <><MicOff className="mr-1 h-3.5 w-3.5" />Stop</> : <><Mic className="mr-1 h-3.5 w-3.5" />Parla</>}
                </Button>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ultime azioni</div>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background/50 p-2 text-xs">
                  {actionLog.length === 0 ? (
                    <div className="text-muted-foreground">Nessuna azione ancora.</div>
                  ) : (
                    actionLog.map((a, i) => (
                      <div key={i} className="truncate text-foreground">• {a}</div>
                    ))
                  )}
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground">
                Prova: "portami sui partner italiani caldi", "apri il dettaglio di…", "evidenzia il bottone invia".
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={() => setExpanded(true)}
            className={`group relative h-14 w-14 rounded-full border-2 shadow-xl transition-all ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:scale-105"
            }`}
            aria-label="Apri Co-Pilot"
          >
            <Mic className={`mx-auto h-5 w-5 ${voice.isSpeaking ? "animate-pulse" : ""}`} />
            {isActive && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card animate-pulse" />
            )}
          </button>
        )}
      </div>
    </>
  );
}