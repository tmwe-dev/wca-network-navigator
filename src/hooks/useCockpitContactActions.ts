/**
 * useCockpitContactActions — hook wrapper sulle funzioni DAL usate dai menu
 * del Cockpit (azioni su contatti singoli e bulk).
 *
 * Esiste per rispettare la regola architetturale "i componenti non importano
 * da src/data/ direttamente": qui centralizziamo gli accessi DAL così che
 * ContactActionMenu / BulkActionMenu restino logic-only sul lato UI.
 */
import { useMemo } from "react";
import { insertActivity } from "@/data/activities";
import { deleteCockpitQueueItem } from "@/data/cockpitQueue";
import {
  createCampaignDraftQueue,
  type CreateCampaignDraftQueueInput,
  type CreateCampaignDraftQueueResult,
} from "@/data/emailCampaigns";
import type { Database } from "@/integrations/supabase/types";

type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];

export interface CockpitContactActions {
  readonly insertActivity: (activity: ActivityInsert) => Promise<void>;
  readonly deleteCockpitQueueItem: (id: string) => Promise<void>;
  readonly createCampaignDraftQueue: (
    input: CreateCampaignDraftQueueInput,
  ) => Promise<CreateCampaignDraftQueueResult>;
}

export function useCockpitContactActions(): CockpitContactActions {
  return useMemo(
    () => ({
      insertActivity,
      deleteCockpitQueueItem,
      createCampaignDraftQueue,
    }),
    [],
  );
}
