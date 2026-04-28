/**
 * DrawerErrorBoundary — compact error boundary for drawers/modals.
 * Reports to Sentry and shows an inline recovery UI instead of crashing the host page.
 */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Sentry } from "@/lib/sentry";

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
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[DrawerErrorBoundary:${this.props.scope}]`, error, info.componentStack);
    Sentry.captureException(error, {
      tags: { boundary: "drawer", scope: this.props.scope },
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
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
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Chiudi e riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}