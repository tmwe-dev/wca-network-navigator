import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  feature: string;
  children: ReactNode;
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
    console.error(`[FeatureErrorBoundary:${this.props.feature}]`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[200px]">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground">
            Something went wrong in {this.props.feature}
          </h3>
          <p className="text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
        </div>
        <button
          onClick={this.handleRetry}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }
}
