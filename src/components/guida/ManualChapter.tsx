import { LucideIcon, MapPin, MousePointerClick, RefreshCw, Lightbulb } from "lucide-react";
import SectionWrapper from "./SectionWrapper";
import RealScreenshot from "./RealScreenshot";

export interface ManualBlock {
  /** Titolo del blocco, es. "Dove si trova" */
  title: string;
  /** Voci elenco */
  items: string[];
  /** Tipo di blocco: determina icona/colore */
  kind?: "where" | "do" | "update";
}

interface ManualChapterProps {
  /** Numero, es. "01" */
  number: string;
  /** Macro-area, es. "CONFIG" */
  area: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Percorso reale della pagina, es. "/v2/settings" */
  path: string;
  /** Screenshot reale (asset Vite importato) */
  screenshot: string;
  screenshotAlt: string;
  /** Paragrafo introduttivo */
  intro: string;
  /** Blocchi operativi (dove/cosa/come) */
  blocks: ManualBlock[];
  /** Suggerimento finale opzionale */
  tip?: string;
}

const KIND_META: Record<NonNullable<ManualBlock["kind"]>, { icon: LucideIcon; label: string }> = {
  where: { icon: MapPin, label: "Dove si trova" },
  do: { icon: MousePointerClick, label: "Cosa puoi fare" },
  update: { icon: RefreshCw, label: "Come si aggiorna" },
};

const ManualChapter = ({
  number,
  area,
  icon: Icon,
  title,
  subtitle,
  path,
  screenshot,
  screenshotAlt,
  intro,
  blocks,
  tip,
}: ManualChapterProps) => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="space-y-8">
      {/* Intestazione capitolo */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary text-base font-bold">
            {number}
          </span>
          <span className="text-white/40 text-xs font-semibold tracking-widest uppercase">{area}</span>
          <span className="ml-auto text-[11px] font-mono text-white/40 px-2 py-1 rounded bg-white/5 border border-white/10">
            {path}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-primary shrink-0" />
          <h2 className="text-3xl font-bold text-white">{title}</h2>
        </div>
        <p className="text-lg text-white/50">{subtitle}</p>
        <p className="text-white/50 leading-relaxed max-w-3xl">{intro}</p>
      </div>

      {/* Foto della pagina reale */}
      <RealScreenshot src={screenshot} alt={screenshotAlt} title={path} />

      {/* Blocchi operativi */}
      <div className="grid md:grid-cols-3 gap-4">
        {blocks.map((b, i) => {
          const meta = KIND_META[b.kind ?? "do"];
          const MetaIcon = meta.icon;
          return (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <MetaIcon className="w-4 h-4" />
                <h3 className="text-sm font-bold tracking-wide uppercase text-white/80">{b.title}</h3>
              </div>
              <ul className="space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="text-sm text-white/55 leading-relaxed">
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Suggerimento */}
      {tip && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-white/60 leading-relaxed">{tip}</p>
        </div>
      )}
    </div>
  </SectionWrapper>
);

export default ManualChapter;
