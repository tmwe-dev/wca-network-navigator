import { OptimizedImage } from "@/components/shared/OptimizedImage";
import albertTalkGif from "@/assets/albert-talk.gif";

export function OraclePanelHeader() {
  return (
    <div className="shrink-0 px-3 py-2 border-b border-border/30 flex items-center gap-2">
      <div className="shrink-0 w-9 h-9">
        <OptimizedImage
          src={albertTalkGif}
          alt="Oracolo"
          className="w-full h-full object-contain rounded-md"
        />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-foreground/80">
          Oracolo
        </span>
        <span className="text-[10px] text-muted-foreground">
          Spiega l'obiettivo della mail
        </span>
      </div>
    </div>
  );
}
