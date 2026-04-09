import { Component, type ReactNode, type ErrorInfo } from "react";
import { createLogger } from "@/lib/log";
import { AlertTriangle, RefreshCw } from "lucide-react";

const log = createLogger("FeatureErrorBoundary");

interface Props {
  children: ReactNode;
  featureName: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    log.error(`[${this.props.featureName}] component error`, {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Errore in {this.props.featureName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {this.state.error?.message || "Si è verificato un errore imprevisto."}
          </p>
        </div>
        <button
          onClick={this.handleRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Riprova
        </button>
      </div>
    );
  }
}

/** HOC to wrap a lazy component with FeatureErrorBoundary */
export function withFeatureBoundary(
  element: ReactNode,
  featureName: string
): ReactNode {
  return (
    <FeatureErrorBoundary featureName={featureName}>
      {element}
    </FeatureErrorBoundary>
  );
}
