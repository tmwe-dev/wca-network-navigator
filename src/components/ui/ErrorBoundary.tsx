/**
 * ErrorBoundary — Generic error boundary for Sprint J UX hardening.
 * Catches render errors, shows friendly recovery UI with retry.
 */
import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import { createLogger } from "@/lib/log";

const log = createLogger("ErrorBoundary");

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error("[ErrorBoundary]", { detail: error, info.componentStack }); // eslint-disable-line no-console
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert" className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Qualcosa è andato storto</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "Si è verificato un errore imprevisto."}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Riprova
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
