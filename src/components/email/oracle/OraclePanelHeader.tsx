import { OptimizedImage } from "@/components/shared/OptimizedImage";
import albertTalkGif from "@/assets/albert-talk.gif";

export function OraclePanelHeader() {
  return (
    <div className="shrink-0 px-3 py-3 border-b border-border/30 flex flex-col items-center gap-1.5">
      <div className="shrink-0 w-[100px] h-[100px]">
        <OptimizedImage
          src={albertTalkGif}
          alt="Oracolo"
          className="w-full h-full object-contain rounded-xl"
        />
      </div>
      <span className="text-xs font-semibold tracking-wide uppercase text-foreground/80">
        Oracolo
      </span>
    </div>
  );
}
