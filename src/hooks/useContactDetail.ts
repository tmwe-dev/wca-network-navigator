import { useReducer, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useContactInteractions,
  useUpdateLeadStatus,
  useCreateContactInteraction,
  type LeadStatus,
} from "@/hooks/useContacts";
import { toast } from "@/hooks/use-toast";

export interface ContactDetail {
  id: string;
  company_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  origin: string | null;
  position: string | null;
  lead_status: string;
  deep_search_at: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  created_at: string;
  company_alias: string | null;
  contact_alias: string | null;
  note: string | null;
  enrichment_data?: Record<string, unknown> | null;
  lead_score?: number | null;
  lead_score_breakdown?: Record<string, number> | null;
}

interface DetailState {
  contact: ContactDetail;
  aliasLoading: boolean;
  detailsOpen: boolean;
  showNewInteraction: boolean;
  newType: string;
  newTitle: string;
  newDesc: string;
  newOutcome: string;
}

type DetailAction =
  | { type: "SET_CONTACT"; contact: ContactDetail }
  | { type: "SET_ALIAS_LOADING"; value: boolean }
  | { type: "TOGGLE_DETAILS"; value: boolean }
  | { type: "SHOW_INTERACTION"; value: boolean }
  | { type: "SET_NEW_TYPE"; value: string }
  | { type: "SET_NEW_TITLE"; value: string }
  | { type: "SET_NEW_DESC"; value: string }
  | { type: "SET_NEW_OUTCOME"; value: string }
  | { type: "RESET_INTERACTION_FORM" }
  | { type: "INCREMENT_INTERACTIONS" };

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case "SET_CONTACT":
      return { ...state, contact: action.contact };
    case "SET_ALIAS_LOADING":
      return { ...state, aliasLoading: action.value };
    case "TOGGLE_DETAILS":
      return { ...state, detailsOpen: action.value };
    case "SHOW_INTERACTION":
      return { ...state, showNewInteraction: action.value };
    case "SET_NEW_TYPE":
      return { ...state, newType: action.value };
    case "SET_NEW_TITLE":
      return { ...state, newTitle: action.value };
    case "SET_NEW_DESC":
      return { ...state, newDesc: action.value };
    case "SET_NEW_OUTCOME":
      return { ...state, newOutcome: action.value };
    case "RESET_INTERACTION_FORM":
      return { ...state, showNewInteraction: false, newTitle: "", newDesc: "", newOutcome: "" };
    case "INCREMENT_INTERACTIONS":
      return { ...state, contact: { ...state.contact, interaction_count: state.contact.interaction_count + 1 } };
    default:
      return state;
  }
}

interface AliasResponse {
  processed?: number;
}

interface MatchedBusinessCard {
  photo_url: string | null;
  event_name: string | null;
  met_at: string | null;
  location: string | null;
}

interface UseContactDetailOptions {
  contact: ContactDetail;
  onContactUpdated?: (updated: ContactDetail) => void;
}

export function useContactDetail({ contact, onContactUpdated }: UseContactDetailOptions) {
  const [state, dispatch] = useReducer(detailReducer, {
    contact,
    aliasLoading: false,
    detailsOpen: false,
    showNewInteraction: false,
    newType: "note",
    newTitle: "",
    newDesc: "",
    newOutcome: "",
  });

  const { data: interactions = [] } = useContactInteractions(state.contact.id);
  const updateStatus = useUpdateLeadStatus();
  const createInteraction = useCreateContactInteraction();
  const queryClient = useQueryClient();

  const { data: matchedCard } = useQuery({
    queryKey: ["business-card-for-contact", state.contact.id],
    queryFn: async (): Promise<MatchedBusinessCard | null> => {
      const { data } = await supabase
        .from("business_cards")
        .select("photo_url, event_name, met_at, location")
        .eq("matched_contact_id", state.contact.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 120_000,
  });

  useEffect(() => {
    dispatch({ type: "SET_CONTACT", contact });
  }, [contact]);

  const needsAlias = !state.contact.company_alias && !state.contact.contact_alias;

  const handleGenerateAlias = useCallback(async () => {
    if (state.aliasLoading) return;
    dispatch({ type: "SET_ALIAS_LOADING", value: true });
    try {
      const data = await invokeEdge<AliasResponse>("generate-aliases", {
        body: { contactIds: [state.contact.id] },
        context: "ContactDetailPanel.generate_aliases",
      });
      const processed = data?.processed || 0;
      if (processed === 0) {
        toast({ title: "Alias già presente", description: "Questo contatto ha già un alias generato" });
      } else {
        toast({ title: "✨ Alias generato", description: `${processed} contatti elaborati con successo` });
      }
      const { getContactById } = await import("@/data/contacts");
      const updated = await getContactById(state.contact.id).catch(() => null);
      if (updated) {
        dispatch({ type: "SET_CONTACT", contact: updated as ContactDetail });
        onContactUpdated?.(updated as ContactDetail);
      }
      queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      dispatch({ type: "SET_ALIAS_LOADING", value: false });
    }
  }, [state.aliasLoading, state.contact.id, onContactUpdated, queryClient]);

  const handleStatusChange = useCallback((s: LeadStatus) => {
    updateStatus.mutate(
      { ids: [state.contact.id], status: s },
      {
        onSuccess: () => {
          toast({ title: "Status aggiornato" });
          dispatch({ type: "SET_CONTACT", contact: { ...state.contact, lead_status: s } });
        },
      },
    );
  }, [state.contact, updateStatus]);

  const handleAddInteraction = useCallback(() => {
    if (!state.newTitle.trim()) return;
    createInteraction.mutate(
      {
        contact_id: state.contact.id,
        interaction_type: state.newType,
        title: state.newTitle,
        description: state.newDesc || undefined,
        outcome: state.newOutcome && state.newOutcome !== "none" ? state.newOutcome : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Interazione registrata" });
          dispatch({ type: "RESET_INTERACTION_FORM" });
          dispatch({ type: "INCREMENT_INTERACTIONS" });
        },
      },
    );
  }, [state.contact.id, state.newType, state.newTitle, state.newDesc, state.newOutcome, createInteraction]);

  return {
    state,
    dispatch,
    interactions,
    matchedCard,
    needsAlias,
    createInteractionPending: createInteraction.isPending,
    handleGenerateAlias,
    handleStatusChange,
    handleAddInteraction,
  };
}
