import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[GlobalErrorBoundary]", error, errorInfo);
  }

  private getDiagnosticInfo(): string {
    const { error, errorInfo } = this.state;
    const lines: string[] = [
      `--- WCA Network Navigator Diagnostic ---`,
      `Timestamp: ${new Date().toISOString()}`,
      `Route: ${window.location.pathname}`,
      `UserAgent: ${navigator.userAgent}`,
    ];

    // Try to get user id from localStorage session
    try {
      const storageKey = Object.keys(localStorage).find(k => k.includes("supabase") && k.includes("auth"));
      if (storageKey) {
        const session = JSON.parse(localStorage.getItem(storageKey) || "{}");
        lines.push(`UserID: ${session?.user?.id || "unknown"}`);
      }
    } catch { lines.push("UserID: unknown"); }

    // Last WCA error
    try {
      const lastErr = localStorage.getItem("last_wca_error");
      if (lastErr) lines.push(`Last WCA Error: ${lastErr}`);
    } catch {}

    lines.push("");
    lines.push(`Error: ${error?.message || "Unknown"}`);
    lines.push("");
    lines.push(`Stack:\n${error?.stack || "N/A"}`);

    if (errorInfo?.componentStack) {
      lines.push("");
      lines.push(`Component Stack:\n${errorInfo.componentStack}`);
    }

    return lines.join("\n");
  }

  private handleCopy = () => {
    navigator.clipboard.writeText(this.getDiagnosticInfo()).catch(() => {});
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="text-5xl">💥</div>
          <h1 className="text-xl font-semibold text-foreground">Unexpected runtime error</h1>
          <p className="text-sm text-muted-foreground">
            L'applicazione ha riscontrato un errore imprevisto. Puoi ricaricare la pagina o copiare le informazioni diagnostiche per il supporto.
          </p>
          <pre className="text-left text-xs bg-muted/50 border border-border rounded-lg p-4 max-h-48 overflow-auto text-muted-foreground whitespace-pre-wrap">
            {this.state.error?.message}
          </pre>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Ricarica app
            </button>
            <button
              onClick={this.handleCopy}
              className="px-4 py-2 rounded-md border border-border bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              Copia diagnostica
            </button>
          </div>
        </div>
      </div>
    );
  }
}
