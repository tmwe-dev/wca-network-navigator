/**
 * kbAndPlaybookAssembler.ts — Load sales knowledge base and active playbook
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import { fetchKbEntriesStrategic } from "./kbAssembler.ts";
import { loadActivePlaybook } from "./playbookLoader.ts";
import { loadOperativePromptsBlock } from "./operativePromptsLoader.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface KbAndPlaybook {
  salesKBSlice: string;
  salesKBSections: string[];
  playbookBlock?: string;
  playbookActive?: boolean;
  operativePromptsBlock?: string;
  operativePromptsApplied?: string[];
}

/**
 * Load sales knowledge base based on email category and interaction history.
 */
async function loadKnowledgeBase(
  supabase: SupabaseClient,
  quality: Quality,
  userId: string,
  emailCategory: string,
  hasInteractionHistory: boolean,
  touchCount: number,
  kbCategories?: string[] | null,
): Promise<{ text: string; sections: string[] }> {
  const isFollowUp =
    emailCategory === "follow_up" || hasInteractionHistory || touchCount > 0;

  const kbResult = await fetchKbEntriesStrategic(supabase, quality, userId, {
    emailCategory,
    hasInteractionHistory,
    isFollowUp,
    kb_categories: kbCategories ?? undefined,
  });

  if (!kbResult.text) {
    console.warn(
      "[generate-email] kb_entries vuoto, fallback monolitico DEPRECATO — migrare a kb_entries",
    );
  }

  return { text: kbResult.text, sections: kbResult.sections_used };
}

/**
 * Assemble KB and playbook for email generation.
 */
export async function assembleKbAndPlaybook(
  supabase: SupabaseClient,
  quality: Quality,
  userId: string,
  emailCategory: string | undefined,
  hasInteractionHistory: boolean,
  touchCount: number | undefined,
  partnerId: string | undefined,
  kbCategories?: string[] | null,
): Promise<KbAndPlaybook> {
  const tcForCategory = touchCount ?? 0;
  const inferredCategory = tcForCategory === 0 ? "primo_contatto" : "follow_up";
  const finalCategory = emailCategory || inferredCategory;

  const [kbResult, playbook, operativePrompts] = await Promise.all([
    loadKnowledgeBase(
      supabase,
      quality,
      userId,
      finalCategory,
      hasInteractionHistory,
      tcForCategory,
      kbCategories,
    ),
    loadActivePlaybook(supabase, userId, partnerId ?? null),
    loadOperativePromptsBlock(supabase, userId),
  ]);

  return {
    salesKBSlice: kbResult.text,
    salesKBSections: kbResult.sections,
    playbookBlock: playbook.block,
    playbookActive: playbook.active,
    operativePromptsBlock: operativePrompts.block || undefined,
    operativePromptsApplied: operativePrompts.appliedNames.length > 0 ? operativePrompts.appliedNames : undefined,
  };
}
