/**
 * PageErrorBoundary — Catches render errors per-section,
 * shows recovery UI instead of crashing the whole app.
 * Re-exported from V2 atom for V1 compatibility.
 */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Sentry } from "@/lib/sentry";

interface State {
  hasError: boolean;
  error?: Error;
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[PageErrorBoundary]", error, info.componentStack);
    Sentry.captureException(error, {
      tags: { boundary: "page" },
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Qualcosa è andato storto</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "Si è verificato un errore imprevisto."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Ricarica pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
