/**
 * ComposeAiConfigContext — stato condiviso dei controlli AI del Compose
 * (tipo email, tono, KB on/off, brief strutturato, customGoal). Persistito
 * su localStorage con le STESSE storage keys che usava `OraclePanel`, così
 * la migrazione UI non cambia comportamento dell'AI di generazione.
 *
 * Il provider viene montato da `EmailComposerPage` e consumato da:
 *   - `EmailComposeFiltersSection` (sidebar sinistra: tipo / tono / brief)
 *   - `OraclePanelSlim`            (pannello destro: obiettivo + Genera/Migliora)
 *
 * Nessuna logica AI, di invio o di journalistReview vive qui dentro.
 */
import * as React from "react";
import { EMPTY_BRIEF, type EmailBrief } from "@/components/email/BriefAccordion";
import type { EmailType } from "@/data/defaultEmailTypes";

const LS_KEY = "compose-ai-config-v1";

export interface ComposeAiConfigState {
  selectedType: EmailType | null;
  tone: string;
  useKB: boolean;
  brief: EmailBrief;
  customGoal: string;
}

interface ComposeAiConfigContextValue extends ComposeAiConfigState {
  setSelectedType: (t: EmailType | null) => void;
  setTone: (v: string) => void;
  setUseKB: (v: boolean) => void;
  setBrief: (b: EmailBrief) => void;
  setCustomGoal: (v: string) => void;
  reset: () => void;
}

const DEFAULTS: ComposeAiConfigState = {
  selectedType: null,
  tone: "professionale",
  useKB: true,
  brief: EMPTY_BRIEF,
  customGoal: "",
};

function loadInitial(): ComposeAiConfigState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ComposeAiConfigState>;
    return {
      selectedType: parsed.selectedType ?? null,
      tone: parsed.tone ?? DEFAULTS.tone,
      useKB: typeof parsed.useKB === "boolean" ? parsed.useKB : DEFAULTS.useKB,
      brief: parsed.brief ?? DEFAULTS.brief,
      customGoal: parsed.customGoal ?? "",
    };
  } catch {
    return DEFAULTS;
  }
}

const Ctx = React.createContext<ComposeAiConfigContextValue | null>(null);

export function ComposeAiConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ComposeAiConfigState>(loadInitial);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage off → ignore */
    }
  }, [state]);

  const value = React.useMemo<ComposeAiConfigContextValue>(
    () => ({
      ...state,
      setSelectedType: (selectedType) => setState((s) => ({ ...s, selectedType })),
      setTone: (tone) => setState((s) => ({ ...s, tone })),
      setUseKB: (useKB) => setState((s) => ({ ...s, useKB })),
      setBrief: (brief) => setState((s) => ({ ...s, brief })),
      setCustomGoal: (customGoal) => setState((s) => ({ ...s, customGoal })),
      reset: () => setState(DEFAULTS),
    }),
    [state],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useComposeAiConfig(): ComposeAiConfigContextValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useComposeAiConfig must be used inside ComposeAiConfigProvider");
  return v;
}
