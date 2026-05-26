/**
 * DrawerErrorBoundary — compact error boundary for drawers/modals.
 * Reports to Sentry and shows an inline recovery UI instead of crashing the host page.
 */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Sentry } from "@/lib/sentry";

import { createLogger } from "@/lib/log";

const log = createLogger("DrawerErrorBoundary");

const DYNAMIC_IMPORT_ERROR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;
const CHUNK_RELOAD_KEY = "__vite_chunk_reload_at__";
const CHUNK_RELOAD_COOLDOWN_MS = 15000;

interface State {
  hasError: boolean;
  error?: Error;
}

interface Props {
  /** Identifier used in Sentry tags for triage (e.g. "ContactRecordDrawer"). */
  scope: string;
  children: React.ReactNode;
  /** Optional callback invoked when the user clicks "Reset" — typically to close the drawer. */
  onReset?: () => void;
}

export class DrawerErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error("DrawerErrorBoundary caught", { scope: this.props.scope, error, componentStack: info.componentStack });
    Sentry.captureException(error, {
      tags: { boundary: "drawer", scope: this.props.scope },
      extra: { componentStack: info.componentStack },
    });

    // Stale chunk after dev-server restart / new deploy: force a one-shot reload
    // so React.lazy re-fetches the module fresh. Uses the same cooldown key as
    // ViteChunkRecovery to avoid reload loops.
    const message = error?.message || "";
    if (DYNAMIC_IMPORT_ERROR_RE.test(message)) {
      try {
        const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
        if (Date.now() - last >= CHUNK_RELOAD_COOLDOWN_MS) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    // For chunk errors, reset alone won't help — the lazy import is permanently rejected.
    if (this.state.error && DYNAMIC_IMPORT_ERROR_RE.test(this.state.error.message)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Errore nel pannello</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            {this.state.error?.message || "Si è verificato un errore imprevisto."}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-3 py-1.5 text-xs rounded-md bg-card/60 dark:bg-card/40 border border-primary/60 text-primary hover:bg-primary/15 hover:border-primary transition-colors"
          >
            Chiudi e riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}