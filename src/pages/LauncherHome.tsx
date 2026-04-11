import { useNavigate } from "react-router-dom";

export default function LauncherHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-8">
        <h1 className="text-3xl font-bold text-foreground">WCA Network Navigator</h1>
        <p className="text-muted-foreground">Seleziona la versione</p>
        <div className="flex gap-6">
          <button
            onClick={() => navigate("/v1")}
            className="px-8 py-6 rounded-xl border border-border bg-card hover:bg-accent transition-colors space-y-2"
          >
            <span className="block text-2xl font-bold text-foreground">V1</span>
            <span className="block text-sm text-muted-foreground">Versione attuale</span>
          </button>
          <button
            onClick={() => navigate("/v2")}
            className="px-8 py-6 rounded-xl border border-primary bg-primary/10 hover:bg-primary/20 transition-colors space-y-2"
          >
            <span className="block text-2xl font-bold text-primary">V2</span>
            <span className="block text-sm text-muted-foreground">Nuova architettura</span>
          </button>
        </div>
      </div>
    </div>
  );
}
