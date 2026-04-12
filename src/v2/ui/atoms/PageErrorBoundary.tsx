/**
 * PageErrorBoundary — Catches render errors per-page,
 * shows recovery UI instead of crashing the whole app
 */
import * as React from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

export class PageErrorBoundary extends React.Component<
  { children: React.ReactNode; pageName?: string },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-foreground">
            Errore nel caricamento{this.props.pageName ? ` di ${this.props.pageName}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "Si è verificato un errore imprevisto."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
