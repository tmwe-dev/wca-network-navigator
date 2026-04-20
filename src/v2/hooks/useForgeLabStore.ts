/**
 * useForgeLabStore — module-level reactive store to share Email Forge Lab
 * state (recipient + email type) between the page (right side) and the
 * global FiltersDrawer (left "linguetta"), without wrapping the whole app
 * in a new Provider.
 */
import { useSyncExternalStore } from "react";
import type { ForgeRecipient } from "@/v2/ui/pages/email-forge/ForgeRecipientPicker";
import type { EmailType } from "@/data/defaultEmailTypes";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";
import { presetToForgeConfig, type DeepSearchQuality } from "@/lib/deepSearchPresets";

export interface DeepSearchConfig {
  scrapeWebsite: boolean;
  linkedinContacts: boolean;
  linkedinCompany: boolean;
  whatsapp: boolean;
  maxQueriesPerContact: number;
  priorityDomain: string;
}

export interface ForgeLabState {
  recipient: ForgeRecipient | null;
  emailType: EmailType | null;
  tone: string;
  useKB: boolean;
  customGoal: string;
  baseProposal: string;
  quality: "fast" | "standard" | "premium";
  /** Bumped each time the user clicks "Genera" from the drawer to trigger a run on the page. */
  runCounter: number;
  deepSearchConfig: DeepSearchConfig;
}

const initial: ForgeLabState = {
  recipient: null,
  emailType: DEFAULT_EMAIL_TYPES[0] ?? null,
  tone: "professionale",
  useKB: true,
  customGoal: "",
  baseProposal: "",
  quality: "standard",
  runCounter: 0,
  deepSearchConfig: presetToForgeConfig("standard"),
};

let state: ForgeLabState = initial;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const forgeLabStore = {
  get: () => state,
  set: (patch: Partial<ForgeLabState>) => {
    // Auto-sync: se cambia quality, ricalcola deepSearchConfig dal preset
    // (preserva priorityDomain manuale).
    let next = { ...state, ...patch };
    if (patch.quality && patch.quality !== state.quality) {
      next = {
        ...next,
        deepSearchConfig: presetToForgeConfig(
          patch.quality as DeepSearchQuality,
          state.deepSearchConfig.priorityDomain,
        ),
      };
    }
    state = next;
    emit();
  },
  triggerRun: () => {
    state = { ...state, runCounter: state.runCounter + 1 };
    emit();
  },
  reset: () => {
    state = { ...initial, runCounter: state.runCounter };
    emit();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useForgeLab(): ForgeLabState {
  return useSyncExternalStore(forgeLabStore.subscribe, forgeLabStore.get, forgeLabStore.get);
}
