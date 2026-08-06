import SectionWrapper from "./SectionWrapper";
import ScreenshotFrame from "./ScreenshotFrame";
import { LucideIcon, CheckCircle2, ChevronRight, Wrench, FlaskConical } from "lucide-react";

export interface TutorialTestStep {
  /** Azione da compiere */
  action: string;
  /** Esito atteso */
  expect: string;
}

interface TutorialChapterProps {
  /** Numero capitolo, es. "CAP. 04" */
  chapter: string;
  /** Macro-area, es. "COMUNICA" */
  area: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Percorso/breadcrumb della pagina, es. "/v2/command" */
  path?: string;
  description: string;
  /** Operazioni possibili nella sezione */
  operations: string[];
  /** Checklist di test: azione → esito atteso */
  tests: TutorialTestStep[];
  /** Mockup visivo opzionale */
  screenshotContent?: React.ReactNode;
  reversed?: boolean;
}

const TutorialChapter = ({
  chapter,
  area,
  icon: Icon,
  title,
  subtitle,
  path,
  description,
  operations,
  tests,
  screenshotContent,
  reversed = false,
}: TutorialChapterProps) => (
  <SectionWrapper className="bg-[#0a0a0f]">
    <div className="space-y-10">
      {/* Header capitolo */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-primary text-xs font-bold tracking-widest uppercase">{chapter}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/40 text-xs font-semibold tracking-widest uppercase">{area}</span>
          {path && (
            <span className="ml-auto text-[11px] font-mono text-white/40 px-2 py-1 rounded bg-white/5 border border-white/10">
              {path}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-primary shrink-0" />
          <h2 className="text-3xl font-bold text-white">{title}</h2>
        </div>
        <p className="text-lg text-white/50">{subtitle}</p>
        <p className="text-white/50 leading-relaxed max-w-3xl">{description}</p>
      </div>

      {/* Corpo: testo + mockup */}
      <div className={`grid md:grid-cols-2 gap-10 items-start ${reversed ? "direction-rtl" : ""}`}>
        {/* Operazioni */}
        <div className="space-y-4" style={{ direction: "ltr" }}>
          <div className="flex items-center gap-2 text-white/70">
            <Wrench className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold tracking-wide uppercase">Operazioni possibili</h3>
          </div>
          <ul className="space-y-2">
            {operations.map((op, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/55">
                <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{op}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup */}
        <div style={{ direction: "ltr" }}>
          {screenshotContent && (
            <ScreenshotFrame title={title}>
              <div className="p-6 min-h-[220px]">{screenshotContent}</div>
            </ScreenshotFrame>
          )}
        </div>
      </div>

      {/* Test di verifica */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4">
        <div className="flex items-center gap-2 text-white/80">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold tracking-wide uppercase">Test di verifica</h3>
        </div>
        <ol className="space-y-3">
          {tests.map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <div className="text-sm">
                <p className="text-white/70">{t.action}</p>
                <p className="flex items-start gap-1.5 text-white/50 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  <span>
                    <span className="text-success font-medium">Atteso:</span> {t.expect}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  </SectionWrapper>
);

export default TutorialChapter;
