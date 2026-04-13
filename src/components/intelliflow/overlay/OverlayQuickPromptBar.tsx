import AiEntity from "../AiEntity";

interface OverlayQuickPromptBarProps {
  statsLine: string;
  pageLabel: string;
  quickPrompts: string[];
  onSend: (text: string) => void;
}

export function OverlayQuickPromptBar({ statsLine, pageLabel, quickPrompts, onSend }: OverlayQuickPromptBarProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div className="mb-8"><AiEntity size="lg" /></div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Cosa vuoi ottenere?</h2>
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">{statsLine}</p>
      <div className="flex items-center gap-1.5 mb-8 text-[10px] text-muted-foreground">
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{pageLabel}</span>
        <span>·</span>
        <span>Comandi contestuali attivi</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {quickPrompts.map((p) => (
          <button key={p} onClick={() => onSend(p)}
            className="text-xs px-4 py-2.5 rounded-full border border-border bg-card/80 text-foreground/80 hover:text-foreground hover:bg-card transition-colors font-medium">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
